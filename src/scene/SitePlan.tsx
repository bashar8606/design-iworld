import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import type { MapContent, SitePlan as Plan, Vec2 } from '../game/types.ts'
import { zoneOwned } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'
import { glowLamp, propMaterial } from './materials.ts'
import {
  chaletGeometry,
  lampHeadGeometry,
  lampPoleGeometry,
  palmGeometry,
  pineGeometry,
  planterGeometry,
  staffHutGeometry,
  yardFenceGeometry,
} from './props/geometry.ts'

/** The fixed parts of a map's site plan: plaza paving, the energy yard, buildings and scenery. */
export function SitePlan() {
  const mapId = useGame((s) => s.state.mapId)
  const map = getContent(mapId).map
  const site = map.site
  if (!site) return null
  return (
    <group>
      {site.plaza && <Plaza box={site.plaza} theme={map.theme} />}
      {site.yard && <Yard yard={site.yard} />}
      {(site.buildings ?? []).map((b, i) => (
        <Building key={i} map={map} building={b} />
      ))}
      <Decor decor={site.decor ?? []} />
    </group>
  )
}

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const PAVERS = {
  desert: { hue: 36, sat: 38, light: 86, joint: 'rgba(150,120,80,0.45)' },
  city: { hue: 215, sat: 8, light: 80, joint: 'rgba(80,90,100,0.45)' },
  snow: { hue: 205, sat: 18, light: 88, joint: 'rgba(110,130,150,0.45)' },
} as const

/** Square pavers with thin joints, 1 m to a tile, tinted for the map. */
function paverTexture(theme: MapContent['theme']): THREE.CanvasTexture {
  const p = PAVERS[theme]
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const rand = seeded(3)
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++) {
      const l = p.light + rand() * 6
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${l}%)`
      ctx.fillRect(x * 64, y * 64, 64, 64)
    }
  ctx.strokeStyle = p.joint
  ctx.lineWidth = 3
  for (const v of [0, 64, 128]) {
    ctx.beginPath()
    ctx.moveTo(v, 0)
    ctx.lineTo(v, 128)
    ctx.moveTo(0, v)
    ctx.lineTo(128, v)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function gravelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#B9B4A8'
  ctx.fillRect(0, 0, 128, 128)
  const rand = seeded(9)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#A39E92' : '#CFCAC0'
    ctx.fillRect(rand() * 128, rand() * 128, 2, 2)
  }
  const t = new THREE.CanvasTexture(canvas)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Plaza({ box, theme }: { box: NonNullable<Plan['plaza']>; theme: MapContent['theme'] }) {
  const w = box.maxX - box.minX
  const d = box.maxZ - box.minZ
  const texture = useMemo(() => {
    const t = paverTexture(theme)
    // Two tiles per texture repeat, one tile per metre.
    t.repeat.set(w / 2, d / 2)
    return t
  }, [w, d, theme])
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[(box.minX + box.maxX) / 2, 0.012, (box.minZ + box.maxZ) / 2]}
      receiveShadow
    >
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial map={texture} roughness={0.9} />
    </mesh>
  )
}

/** Gravel inside a fenced yard, with a gate gap on its west side. */
function Yard({ yard }: { yard: NonNullable<Plan['yard']> }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => yardFenceGeometry(), [])
  const w = yard.maxX - yard.minX
  const d = yard.maxZ - yard.minZ
  const gravel = useMemo(() => {
    const t = gravelTexture()
    t.repeat.set(w / 3, d / 3)
    return t
  }, [w, d])
  // One fence bay per metre along each side, skipping the gate.
  const bays = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = []
    for (let x = yard.minX + 0.5; x < yard.maxX; x += 1) {
      out.push({ x, z: yard.minZ, rot: 0 }, { x, z: yard.maxZ, rot: 0 })
    }
    for (let z = yard.minZ + 0.5; z < yard.maxZ; z += 1) {
      out.push({ x: yard.maxX, z, rot: Math.PI / 2 })
      if (z < yard.gateMinZ || z > yard.gateMaxZ) out.push({ x: yard.minX, z, rot: Math.PI / 2 })
    }
    return out
  }, [yard])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const r = new THREE.Matrix4()
    bays.forEach((b, i) => {
      m.makeRotationY(b.rot).premultiply(r.makeTranslation(b.x, 0, b.z))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [bays])
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(yard.minX + yard.maxX) / 2, 0.011, (yard.minZ + yard.maxZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={gravel} roughness={1} />
      </mesh>
      <instancedMesh ref={ref} args={[geometry, propMaterial, bays.length]} castShadow />
    </group>
  )
}

function Building({
  map,
  building,
}: {
  map: MapContent
  building: NonNullable<Plan['buildings']>[number]
}) {
  const geometry = useMemo(() => staffHutGeometry(), [])
  const owned = useGame((s) => !building.zone || zoneOwned(s.state, map, building.zone))
  if (!owned) return null
  return (
    <mesh
      geometry={geometry}
      material={propMaterial}
      position={[building.pos.x, 0, building.pos.z]}
      castShadow
      receiveShadow
    />
  )
}

function Instances({
  geometry,
  material = propMaterial,
  spots,
  shadows = true,
}: {
  geometry: THREE.BufferGeometry
  material?: THREE.Material
  spots: { pos: Vec2; rot: number; scale: number }[]
  shadows?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.rot)
      m.compose(
        new THREE.Vector3(s.pos.x, 0, s.pos.z),
        q,
        new THREE.Vector3(s.scale, s.scale, s.scale),
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [spots])
  if (spots.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, spots.length]}
      castShadow={shadows}
      receiveShadow
    />
  )
}

function Decor({ decor }: { decor: NonNullable<Plan['decor']> }) {
  const palm = useMemo(() => palmGeometry(), [])
  const pole = useMemo(() => lampPoleGeometry(), [])
  const head = useMemo(() => lampHeadGeometry(), [])
  const planter = useMemo(() => planterGeometry(), [])
  const pine = useMemo(() => pineGeometry(), [])
  const lodge = useMemo(() => chaletGeometry(), [])
  const spots = useMemo(() => {
    const rand = seeded(17)
    const of = (kind: string) =>
      decor
        .filter((d) => d.kind === kind)
        .map((d) => ({
          pos: d.pos,
          // Palms and planters vary a little; lamps all reach over the parking bays (+x).
          rot: kind === 'lamp' || kind === 'lodge' ? 0 : rand() * Math.PI * 2,
          scale: kind === 'palm' || kind === 'pine' ? 0.85 + rand() * 0.35 : 1,
        }))
    return {
      palm: of('palm'),
      pine: of('pine'),
      lamp: of('lamp'),
      planter: of('planter'),
      lodge: of('lodge'),
    }
  }, [decor])
  return (
    <group>
      <Instances geometry={palm} spots={spots.palm} />
      <Instances geometry={pole} spots={spots.lamp} />
      <Instances geometry={head} material={glowLamp} spots={spots.lamp} shadows={false} />
      <Instances geometry={planter} spots={spots.planter} />
      <Instances geometry={pine} spots={spots.pine} />
      <Instances geometry={lodge} spots={spots.lodge} />
    </group>
  )
}
