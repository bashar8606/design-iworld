// Code-built props as merged, vertex-coloured geometries: one shared material, one draw call
// each, and instancing for anything repeated. Pure three.js so tests can count triangles.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PALETTE = {
  sand: '#E9D8B4',
  sandDark: '#D9C08E',
  sky: '#8FC8F0',
  navy: '#1E3557',
  teal: '#19B5A5',
  lime: '#A6E22E',
  white: '#F7F7F2',
  cream: '#F3EEDF',
  concrete: '#D6D2C4',
  asphalt: '#4A4E57',
  metal: '#9AA3AB',
  dark: '#2B2B2E',
  orange: '#F29E4C',
  yellow: '#F7C948',
} as const

type Color = THREE.ColorRepresentation

/** Gives a geometry a flat vertex colour and drops attributes that would block merging. */
export function paint(geometry: THREE.BufferGeometry, color: Color): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
  const c = new THREE.Color(color)
  const count = g.getAttribute('position').count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

function boxAt(
  size: [number, number, number],
  pos: [number, number, number],
  color: Color,
  rot: [number, number, number] = [0, 0, 0],
) {
  const g = new THREE.BoxGeometry(...size)
  g.rotateX(rot[0])
  g.rotateY(rot[1])
  g.rotateZ(rot[2])
  g.translate(...pos)
  return paint(g, color)
}

function cylAt(
  r: number,
  h: number,
  pos: [number, number, number],
  color: Color,
  segments = 10,
  rot: [number, number, number] = [0, 0, 0],
) {
  const g = new THREE.CylinderGeometry(r, r, h, segments)
  g.rotateX(rot[0])
  g.rotateZ(rot[2])
  g.translate(...pos)
  return paint(g, color)
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false)
  if (!merged) throw new Error('Could not merge geometries')
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

export function triangleCount(geometry: THREE.BufferGeometry): number {
  return geometry.index ? geometry.index.count / 3 : geometry.getAttribute('position').count / 3
}

// ---------------------------------------------------------------------------
// Solar panel rows: modules are instanced, so a row is only a list of transforms.

export const PANEL_MODULE = { width: 1.55, depth: 1.0, tilt: 0.38, height: 0.75, perRow: 5 }

/** One panel module: a thin slab whose top face carries the cell-grid texture. */
export function panelModuleGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(PANEL_MODULE.width - 0.06, 0.06, PANEL_MODULE.depth)
  return g
}

/** The frame under one module: two legs and a rail. */
export function panelFrameGeometry(): THREE.BufferGeometry {
  const { depth, height, tilt } = PANEL_MODULE
  const front = height - Math.sin(tilt) * depth * 0.4
  const back = height + Math.sin(tilt) * depth * 0.4
  return merge([
    boxAt([0.08, front, 0.08], [0, front / 2, depth * 0.38], PALETTE.metal),
    boxAt([0.08, back, 0.08], [0, back / 2, -depth * 0.38], PALETTE.metal),
    boxAt([PANEL_MODULE.width, 0.06, 0.08], [0, height - 0.05, 0], PALETTE.metal),
  ])
}

/** Transforms for the modules of one row centred at (x, z), facing the sun (+z tilt). */
export function panelRowMatrices(
  x: number,
  z: number,
  y = 0,
  tiltOverride?: number,
): THREE.Matrix4[] {
  const { width, perRow, height, tilt } = PANEL_MODULE
  const out: THREE.Matrix4[] = []
  const rot = new THREE.Euler(tiltOverride ?? tilt, 0, 0)
  for (let i = 0; i < perRow; i++) {
    const px = x + (i - (perRow - 1) / 2) * width
    out.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(px, y + height + 0.05, z),
        new THREE.Quaternion().setFromEuler(rot),
        new THREE.Vector3(1, 1, 1),
      ),
    )
  }
  return out
}

export function panelFrameMatrices(x: number, z: number, y = 0): THREE.Matrix4[] {
  const { width, perRow } = PANEL_MODULE
  return Array.from({ length: perRow }, (_, i) =>
    new THREE.Matrix4().makeTranslation(x + (i - (perRow - 1) / 2) * width, y, z),
  )
}

/** Canvas texture with the navy cell grid of a solar panel. */
export function panelCellTexture(): THREE.Texture {
  const size = 128
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return new THREE.Texture()
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#2A4A78')
  grad.addColorStop(1, '#16294A')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(190, 220, 255, 0.55)'
  ctx.lineWidth = 2
  const cols = 6
  const rows = 4
  for (let i = 1; i < cols; i++) {
    ctx.beginPath()
    ctx.moveTo((i * size) / cols, 0)
    ctx.lineTo((i * size) / cols, size)
    ctx.stroke()
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath()
    ctx.moveTo(0, (j * size) / rows)
    ctx.lineTo(size, (j * size) / rows)
    ctx.stroke()
  }
  ctx.strokeStyle = '#DDE6EE'
  ctx.lineWidth = 6
  ctx.strokeRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

// ---------------------------------------------------------------------------
// Batteries

export function batteryGeometry(tier: number): THREE.BufferGeometry {
  if (tier === 0) {
    // Small cabinet battery.
    return merge([
      boxAt([2.2, 0.12, 1.3], [0, 0.06, 0], PALETTE.concrete),
      boxAt([2.0, 1.3, 1.1], [0, 0.77, 0], PALETTE.white),
      boxAt([2.06, 0.1, 1.16], [0, 1.45, 0], PALETTE.navy),
      boxAt([0.04, 0.9, 0.7], [-1.01, 0.75, 0], PALETTE.metal),
      cylAt(0.1, 0.05, [0.7, 0.9, 0.56], PALETTE.teal, 8, [Math.PI / 2, 0, 0]),
    ])
  }
  // Container battery with ribs; fits the 4.0 × 2.2 m footprint in footprints.json.
  const parts = [
    boxAt([4.0, 0.14, 2.2], [0, 0.07, 0], PALETTE.concrete),
    boxAt([3.8, 2.1, 2.0], [0, 1.19, 0], PALETTE.white),
    boxAt([3.86, 0.12, 2.06], [0, 2.27, 0], PALETTE.navy),
  ]
  for (let i = 0; i < 6; i++) {
    parts.push(boxAt([0.08, 1.7, 2.06], [-1.6 + i * 0.64, 1.15, 0], '#E3E6E2'))
  }
  parts.push(boxAt([0.5, 0.45, 0.5], [1.3, 2.55, 0], PALETTE.metal))
  return merge(parts)
}

/** Length of the light strip that shows charge, by tier, and where it sits. */
export function batteryStrip(tier: number) {
  return tier === 0
    ? { length: 1.6, pos: [0, 1.2, 0.56] as const }
    : { length: 3.3, pos: [0, 1.85, 1.04] as const }
}

// ---------------------------------------------------------------------------
// Chargers (AC posts are code-built; DC tiers use the Blender fast charger)

export function chargerPostGeometry(tier: number): THREE.BufferGeometry {
  if (tier === 0) {
    return merge([
      boxAt([0.5, 0.1, 0.5], [0, 0.05, 0], PALETTE.concrete),
      cylAt(0.07, 1.2, [0, 0.65, 0], PALETTE.metal, 8),
      boxAt([0.36, 0.46, 0.2], [0, 1.2, 0], PALETTE.white),
      boxAt([0.3, 0.06, 0.21], [0, 1.0, 0.0], PALETTE.teal),
      cylAt(0.06, 0.04, [-0.19, 1.2, 0], PALETTE.dark, 8, [0, 0, Math.PI / 2]),
    ])
  }
  return merge([
    boxAt([0.7, 0.1, 0.6], [0, 0.05, 0], PALETTE.concrete),
    boxAt([0.42, 1.55, 0.38], [0, 0.85, 0], PALETTE.white),
    boxAt([0.46, 0.08, 0.42], [0, 1.66, 0], PALETTE.teal),
    boxAt([0.03, 0.3, 0.22], [-0.22, 1.25, 0], '#123B4A'),
    cylAt(0.06, 0.04, [-0.22, 0.95, -0.1], PALETTE.lime, 8, [0, 0, Math.PI / 2]),
    cylAt(0.06, 0.04, [-0.22, 0.95, 0.1], PALETTE.lime, 8, [0, 0, Math.PI / 2]),
  ])
}

/** One bay's worth of curved canopy over the charger posts (repeat with instancing). */
export function canopySegmentGeometry(length = 3.2): THREE.BufferGeometry {
  const radius = 4.2
  const arc = 0.62
  const eave = 2.7
  // A cylinder slice laid along z. After rotateX(90°), a vertex at angle θ ends up at
  // y = -r·cos θ, so slices centred on θ = π form an arch over the posts.
  const slice = (r: number, len: number, a: number, color: string) => {
    const g = new THREE.CylinderGeometry(r, r, len, 10, 1, true, Math.PI - a / 2, a)
    g.rotateX(Math.PI / 2)
    g.translate(0, eave - radius * Math.cos(arc / 2), 0)
    return paint(g, color)
  }
  return merge([
    slice(radius, length, arc, PALETTE.white),
    slice(radius + 0.04, length - 0.2, arc * 0.8, PALETTE.navy),
    cylAt(0.08, eave, [0.9, eave / 2, length / 2 - 0.1], PALETTE.metal, 8),
    cylAt(0.08, eave, [-0.9, eave / 2, length / 2 - 0.1], PALETTE.metal, 8),
  ])
}

// ---------------------------------------------------------------------------
// Car wash and scenery

export function carWashGeometry(): THREE.BufferGeometry {
  const parts = [
    boxAt([4.2, 0.12, 6], [0, 0.06, 0], PALETTE.concrete),
    boxAt([0.4, 3, 6], [-1.9, 1.5, 0], PALETTE.white),
    boxAt([0.4, 3, 6], [1.9, 1.5, 0], PALETTE.white),
    boxAt([4.2, 0.3, 6.2], [0, 3.1, 0], PALETTE.teal),
    boxAt([3.4, 0.5, 0.4], [0, 2.7, -1.5], PALETTE.sky),
  ]
  // Brush rollers.
  for (const x of [-1.4, 1.4]) parts.push(cylAt(0.35, 2.4, [x, 1.4, 1.2], PALETTE.sky, 10))
  parts.push(boxAt([4.4, 0.6, 0.15], [0, 3.6, 3.0], PALETTE.white))
  return merge(parts)
}

export function duneGeometry(seed = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  const pos = g.getAttribute('position')
  // Deterministic wobble so dunes look hand-made.
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const k = 1 + 0.12 * Math.sin(i * 12.9898 * seed)
    pos.setXYZ(i, pos.getX(i) * k, y * (0.9 + 0.1 * Math.cos(i * 7.1)), pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return paint(g, PALETTE.sandDark)
}

/** Simple skyline blocks for the horizon. */
export function skylineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const heights = [6, 9, 5, 12, 7, 15, 8, 6, 10, 5, 13, 7]
  heights.forEach((h, i) => {
    parts.push(boxAt([3 + (i % 3), h, 3], [i * 4.2 - 24, h / 2, 0], i % 2 ? '#9DB8CF' : '#B5CADB'))
  })
  return merge(parts)
}

/** Small cleaning robot: a rounded body on wheels with a brush in front. */
export function robotGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([0.7, 0.35, 0.8], [0, 0.32, 0], PALETTE.white),
    boxAt([0.6, 0.12, 0.6], [0, 0.55, -0.05], PALETTE.teal),
    cylAt(0.08, 0.3, [0, 0.75, -0.1], PALETTE.metal, 6),
    cylAt(0.1, 0.06, [0, 0.92, -0.1], PALETTE.lime, 8),
    cylAt(0.14, 0.8, [0, 0.14, 0.48], PALETTE.sky, 8, [0, 0, Math.PI / 2]),
    cylAt(0.15, 0.08, [-0.38, 0.15, -0.2], PALETTE.dark, 8, [0, 0, Math.PI / 2]),
    cylAt(0.15, 0.08, [0.38, 0.15, -0.2], PALETTE.dark, 8, [0, 0, Math.PI / 2]),
  ])
}

// ---------------------------------------------------------------------------
// Map 3, the ski lodge: wind turbines, pines, mountains and the lodge.

/** Height of a turbine's hub above the ground (before its tier scale). */
export const TURBINE_HUB = { y: 7.1, z: 0.85 }

/** Turbine tower, nacelle and base; the rotor is separate so it can spin. Faces +z. */
export function turbineTowerGeometry(): THREE.BufferGeometry {
  const tower = new THREE.CylinderGeometry(0.17, 0.3, 7, 10).translate(0, 3.5, 0)
  return merge([
    cylAt(0.6, 0.25, [0, 0.12, 0], PALETTE.concrete, 10),
    paint(tower, PALETTE.white),
    boxAt([0.55, 0.55, 1.4], [0, TURBINE_HUB.y, 0.1], PALETTE.white),
    boxAt([0.56, 0.08, 1.2], [0, TURBINE_HUB.y - 0.12, 0.1], PALETTE.teal),
  ])
}

/** Hub and three blades around the origin, in the xy plane, so a z rotation spins it. */
export function turbineRotorGeometry(): THREE.BufferGeometry {
  const parts = [cylAt(0.22, 0.45, [0, 0, 0], PALETTE.white, 10, [Math.PI / 2, 0, 0])]
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.BoxGeometry(0.26, 2.7, 0.05).translate(0, 1.5, 0)
    blade.rotateZ((i * 2 * Math.PI) / 3)
    parts.push(paint(blade, PALETTE.white))
    const tip = new THREE.BoxGeometry(0.2, 0.45, 0.06).translate(0, 2.65, 0)
    tip.rotateZ((i * 2 * Math.PI) / 3)
    parts.push(paint(tip, PALETTE.orange))
  }
  return merge(parts)
}

/** A pine: trunk and three tiers of needles, each with a dusting of snow unless `snow` is off. */
export function pineGeometry(snow = true): THREE.BufferGeometry {
  const parts = [
    paint(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6).translate(0, 0.45, 0), '#6B4B33'),
  ]
  const tiers = [
    [1.15, 1.3, 1.0],
    [0.9, 1.15, 1.75],
    [0.62, 1.0, 2.45],
  ] as const
  for (const [r, h, y] of tiers) {
    parts.push(paint(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0), '#2F6B4F'))
    if (snow)
      parts.push(
        paint(
          new THREE.ConeGeometry(r * 0.55, h * 0.45, 7).translate(0, y + h * 0.3, 0),
          '#F4F8FB',
        ),
      )
  }
  return merge(parts)
}

/** A distant peak: grey rock with a snow cap. */
export function mountainGeometry(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), '#8796A8'),
    paint(new THREE.ConeGeometry(0.45, 0.45, 7).translate(0, 0.78, 0), '#F4F8FB'),
  ])
}

/** The ski lodge: timber walls, a snowy gable roof, a chimney and lit windows. */
export function chaletGeometry(): THREE.BufferGeometry {
  // A triangular prism along x with its ridge on top.
  const roof = new THREE.CylinderGeometry(4.6, 4.6, 9, 3, 1)
    .rotateZ(Math.PI / 2)
    .rotateX(-Math.PI / 2)
  roof.scale(1, 0.55, 1)
  roof.translate(0, 4.6, 0)
  return merge([
    boxAt([8, 3.6, 6.4], [0, 1.8, 0], '#8A5A3B'),
    boxAt([8.2, 0.3, 6.6], [0, 0.15, 0], '#5E3E2A'),
    paint(roof, '#F4F8FB'),
    boxAt([0.7, 1.8, 0.7], [2.2, 6, -0.8], '#6E6A66'),
    boxAt([1.2, 0.9, 0.1], [-2.2, 2.1, 3.22], PALETTE.yellow),
    boxAt([1.2, 0.9, 0.1], [2.2, 2.1, 3.22], PALETTE.yellow),
    boxAt([1.3, 2.2, 0.1], [0, 1.1, 3.22], '#5E3E2A'),
  ])
}

// ---------------------------------------------------------------------------
// Site plan pieces (map 1): staff hut, palms, street lamps, planters, yard fence posts.

/** Staff hut: a small block with a flat overhanging roof, a door facing +z and a sign. */
export function staffHutGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([5.0, 0.15, 3.2], [0, 0.07, 0], PALETTE.concrete),
    boxAt([4.6, 2.5, 2.8], [0, 1.4, 0], PALETTE.cream),
    boxAt([5.2, 0.22, 3.5], [0, 2.75, 0.1], PALETTE.teal),
    boxAt([1.0, 1.9, 0.08], [-1.2, 1.1, 1.42], PALETTE.navy),
    boxAt([1.4, 0.8, 0.08], [0.8, 1.6, 1.42], '#9DD8F0'),
    boxAt([1.8, 0.45, 0.1], [0.8, 2.35, 1.48], PALETTE.yellow),
    boxAt([0.5, 0.5, 0.5], [1.6, 3.1, -0.6], PALETTE.metal),
  ])
}

/** A desert palm: a slightly bent ringed trunk and a crown of drooping fronds. */
export function palmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) {
    const r = 0.2 - i * 0.015
    const seg = new THREE.CylinderGeometry(r * 0.9, r, 0.62, 7).translate(
      0.04 * i * i * 0.1,
      0.31 + i * 0.6,
      0,
    )
    parts.push(paint(seg, i % 2 ? '#9C7A55' : '#8A6A4A'))
  }
  const top = 3.6
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.BoxGeometry(0.42, 0.06, 1.9).translate(0, 0, 0.95)
    frond.rotateX(0.45)
    frond.rotateY((i / 7) * Math.PI * 2)
    frond.translate(0.18, top, 0)
    parts.push(paint(frond, i % 2 ? '#3E9B5F' : '#4FB06D'))
  }
  parts.push(paint(new THREE.SphereGeometry(0.28, 7, 5).translate(0.18, top, 0), '#6B5236'))
  return merge(parts)
}

/** Street lamp: a slim pole with an arm and a lamp head (the head glows at night). */
export function lampPoleGeometry(): THREE.BufferGeometry {
  return merge([
    cylAt(0.18, 0.2, [0, 0.1, 0], PALETTE.concrete, 8),
    cylAt(0.06, 4.2, [0, 2.2, 0], PALETTE.dark, 8),
    boxAt([0.9, 0.08, 0.08], [0.42, 4.25, 0], PALETTE.dark),
  ])
}

/** The lamp head alone, placed at the end of the arm, for the night-glow material. */
export function lampHeadGeometry(): THREE.BufferGeometry {
  return merge([boxAt([0.46, 0.14, 0.3], [0.82, 4.16, 0], '#FFF4C2')])
}

/** Planter: a concrete box with a round shrub and a few flowers. */
export function planterGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([1.0, 0.5, 1.0], [0, 0.25, 0], '#D9CBB0'),
    boxAt([0.9, 0.06, 0.9], [0, 0.5, 0], '#6B4B33'),
    paint(new THREE.SphereGeometry(0.42, 8, 6).scale(1, 0.8, 1).translate(0, 0.82, 0), '#4FB06D'),
    paint(new THREE.SphereGeometry(0.1, 6, 4).translate(0.22, 1.05, 0.15), '#F29E4C'),
    paint(new THREE.SphereGeometry(0.1, 6, 4).translate(-0.2, 0.98, -0.18), '#E5484D'),
  ])
}

/** One bay of the energy-yard fence: a post and two rails, 1 m long along x. */
export function yardFenceGeometry(): THREE.BufferGeometry {
  return merge([
    cylAt(0.05, 1.3, [-0.5, 0.65, 0], PALETTE.metal, 6),
    boxAt([1.0, 0.05, 0.04], [0, 1.2, 0], PALETTE.metal),
    boxAt([1.0, 0.05, 0.04], [0, 0.6, 0], PALETTE.metal),
    boxAt([1.0, 0.04, 0.02], [0, 0.9, 0], PALETTE.yellow),
  ])
}

// ---------------------------------------------------------------------------
// Quarry (Pine Ridge): the empty site before the pit is dug.

/** A grassy hill on the horizon: a low dome, unit radius and height. */
export function hillGeometry(): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  return merge([paint(dome, '#7FA35A')])
}

/** The site office: a portacabin on blocks with a blue stripe, windows, a door and steps. */
export function siteCabinGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([5.6, 0.3, 2.6], [0, 0.15, 0], '#8C8579'),
    boxAt([5.4, 2.3, 2.4], [0, 1.45, 0], PALETTE.white),
    boxAt([5.5, 0.25, 2.5], [0, 2.7, 0], '#C9CED3'),
    boxAt([5.42, 0.25, 2.42], [0, 0.55, 0], '#2E6DB4'),
    boxAt([0.9, 1.8, 0.06], [-1.6, 1.3, 1.22], PALETTE.navy),
    boxAt([1.4, 0.8, 0.06], [0.3, 1.6, 1.22], '#9DD8F0'),
    boxAt([1.4, 0.8, 0.06], [1.9, 1.6, 1.22], '#9DD8F0'),
    boxAt([1.2, 0.3, 0.8], [-1.6, 0.15, 1.6], '#8C8579'),
  ])
}

/** The site sign by the entrance: two posts and a board in quarry yellow. */
export function siteSignGeometry(): THREE.BufferGeometry {
  return merge([
    cylAt(0.08, 2.4, [-1.1, 1.2, 0], '#6B4B33', 6),
    cylAt(0.08, 2.4, [1.1, 1.2, 0], '#6B4B33', 6),
    boxAt([2.9, 1.2, 0.1], [0, 1.9, 0], PALETTE.yellow),
    boxAt([2.5, 0.22, 0.12], [0, 2.15, 0], PALETTE.navy),
    boxAt([1.6, 0.16, 0.12], [0, 1.75, 0], PALETTE.navy),
  ])
}

/** A surveyor's stake with an orange flag, marking where the pit will be dug. */
export function surveyStakeGeometry(): THREE.BufferGeometry {
  return merge([
    cylAt(0.03, 1.2, [0, 0.6, 0], '#C8A26A', 5),
    boxAt([0.42, 0.26, 0.02], [0.22, 1.0, 0], PALETTE.orange),
  ])
}

/** A loose boulder: a squashed, faceted rock. */
export function boulderGeometry(): THREE.BufferGeometry {
  return merge([paint(new THREE.DodecahedronGeometry(0.6, 0).scale(1, 0.7, 0.85), '#9A948A')])
}

/**
 * The jaw crusher: a steel frame in quarry yellow, the jaw box, a motor with its flywheel and
 * a hopper on the -x side (at x = -2.5) where rock is tipped in.
 */
export function crusherGeometry(): THREE.BufferGeometry {
  const hopper = new THREE.CylinderGeometry(1.25, 0.55, 1.1, 4, 1, true).rotateY(Math.PI / 4)
  const hopperFloor = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 4).rotateY(Math.PI / 4)
  return merge([
    boxAt([4.2, 0.3, 2.6], [-0.4, 0.15, 0], '#8C8579'),
    boxAt([0.25, 2.2, 0.25], [-1.6, 1.3, -1.0], PALETTE.yellow),
    boxAt([0.25, 2.2, 0.25], [-1.6, 1.3, 1.0], PALETTE.yellow),
    boxAt([0.25, 2.2, 0.25], [1.0, 1.3, -1.0], PALETTE.yellow),
    boxAt([0.25, 2.2, 0.25], [1.0, 1.3, 1.0], PALETTE.yellow),
    boxAt([2.9, 0.25, 2.3], [-0.3, 2.45, 0], PALETTE.yellow),
    boxAt([1.6, 1.5, 1.5], [0, 1.4, 0], '#5A5F66'),
    boxAt([0.4, 1.2, 1.3], [-0.85, 1.6, 0], '#3B3E43'),
    cylAt(0.65, 0.22, [0.2, 1.7, 0.95], PALETTE.dark, 14, [Math.PI / 2, 0, 0]),
    boxAt([0.9, 0.7, 0.7], [1.6, 0.75, -0.6], '#2E6DB4'),
    paint(hopper.translate(-2.5, 3.15, 0), PALETTE.yellow),
    paint(hopperFloor.translate(-2.5, 2.62, 0), '#3B3E43'),
    boxAt([1.6, 0.18, 0.18], [-1.75, 2.62, 0], PALETTE.yellow),
    boxAt([0.12, 2.6, 0.12], [-3.1, 1.3, -0.6], PALETTE.yellow),
    boxAt([0.12, 2.6, 0.12], [-3.1, 1.3, 0.6], PALETTE.yellow),
  ])
}

/** A white pickup truck, 4.6 m long along +z, with an open bed at the back. */
export function pickupGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([1.8, 0.55, 4.5], [0, 0.65, 0], PALETTE.white),
    boxAt([1.7, 0.75, 1.6], [0, 1.25, 0.55], PALETTE.white),
    boxAt([1.72, 0.5, 0.06], [0, 1.3, 1.36], '#9DD8F0'),
    boxAt([1.74, 0.42, 1.0], [0, 1.3, 0.6], '#9DD8F0'),
    boxAt([1.8, 0.45, 0.08], [0, 1.15, -0.25], PALETTE.white),
    boxAt([0.08, 0.45, 1.9], [-0.86, 1.15, -1.2], PALETTE.white),
    boxAt([0.08, 0.45, 1.9], [0.86, 1.15, -1.2], PALETTE.white),
    boxAt([1.8, 0.45, 0.08], [0, 1.15, -2.17], PALETTE.white),
    boxAt([1.9, 0.18, 0.2], [0, 0.5, 2.25], PALETTE.dark),
    boxAt([1.9, 0.18, 0.2], [0, 0.5, -2.25], PALETTE.dark),
    boxAt([0.5, 0.18, 0.05], [-0.55, 0.85, 2.26], PALETTE.yellow),
    boxAt([0.5, 0.18, 0.05], [0.55, 0.85, 2.26], PALETTE.yellow),
    ...[-1, 1].flatMap((sx) =>
      [-1.45, 1.45].map((z) =>
        cylAt(0.38, 0.3, [sx * 0.88, 0.38, z], PALETTE.dark, 10, [0, 0, Math.PI / 2]),
      ),
    ),
  ])
}

/** A short section of conveyor: belt, side rails and a leg, 1 m long along +z. */
export function conveyorSectionGeometry(): THREE.BufferGeometry {
  return merge([
    boxAt([0.7, 0.06, 1.0], [0, 0, 0], '#2B2B2E'),
    boxAt([0.08, 0.16, 1.0], [-0.39, 0.05, 0], PALETTE.yellow),
    boxAt([0.08, 0.16, 1.0], [0.39, 0.05, 0], PALETTE.yellow),
  ])
}
