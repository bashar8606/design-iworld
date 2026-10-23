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
  // Shipping-container battery with ribs.
  const parts = [
    boxAt([6.2, 0.14, 2.6], [0, 0.07, 0], PALETTE.concrete),
    boxAt([6.0, 2.3, 2.4], [0, 1.29, 0], PALETTE.white),
    boxAt([6.06, 0.12, 2.46], [0, 2.47, 0], PALETTE.navy),
  ]
  for (let i = 0; i < 9; i++) {
    parts.push(boxAt([0.08, 1.9, 2.46], [-2.6 + i * 0.65, 1.25, 0], '#E3E6E2'))
  }
  parts.push(boxAt([0.6, 0.5, 0.6], [2.2, 2.78, 0], PALETTE.metal))
  return merge(parts)
}

/** Length of the light strip that shows charge, by tier, and where it sits. */
export function batteryStrip(tier: number) {
  return tier === 0
    ? { length: 1.6, pos: [0, 1.2, 0.56] as const }
    : { length: 5.2, pos: [0, 2.05, 1.24] as const }
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
