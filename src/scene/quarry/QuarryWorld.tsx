import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getQuarryContent } from '../../game/quarry/content.ts'
import type { QuarryContent } from '../../game/quarry/types.ts'
import type { Vec2 } from '../../game/types.ts'
import { tickAlpha, useGame } from '../../store/gameStore.ts'
import { sceneView } from '../../store/view.ts'
import { Effects } from '../Effects.tsx'
import { lerp } from '../interp.ts'
import { QuarryLayoutOverlay } from './QuarryLayoutOverlay.tsx'
import { QuarryLoop } from './QuarryLoop.tsx'
import { QuarryTerrain } from './QuarryTerrain.tsx'
import { heightAt } from '../../game/quarry/terrain.ts'
import { propMaterial } from '../materials.ts'
import {
  boulderGeometry,
  hillGeometry,
  pineGeometry,
  siteCabinGeometry,
  siteSignGeometry,
  garageGeometry,
} from '../props/geometry.ts'

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

interface Placement {
  x: number
  y?: number
  z: number
  s: number
  sy?: number
  sz?: number
  r: number
}

function Instances({
  geometry,
  items,
  shadows = false,
}: {
  geometry: THREE.BufferGeometry
  items: Placement[]
  shadows?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    items.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r)
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.sy ?? p.s, p.sz ?? p.s))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, propMaterial, items.length]}
      castShadow={shadows}
      receiveShadow
    />
  )
}

/** Pines everywhere outside the cleared site, out to the horizon. */
function forestPlacements(q: QuarryContent): Placement[] {
  const rand = seeded(q.forest.seed)
  const c = q.site.clearing
  const m = q.forest.margin
  const e = q.forest.extent
  const out: Placement[] = []
  for (let i = 0; out.length < q.forest.count && i < q.forest.count * 20; i++) {
    const x = c.minX - e + rand() * (c.maxX - c.minX + 2 * e)
    const z = c.minZ - e + rand() * (c.maxZ - c.minZ + 2 * e)
    const inSite = x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m
    if (inSite) continue
    // Keep the entrance road (east) and the exit road (south) open.
    const { road } = q.buyers
    if (x > c.maxX - m && Math.abs(z - road.z) < 3.5) continue
    const exit = road.exit.at(-1)!
    if (z > c.maxZ - m && Math.abs(x - exit.x) < 3.5) continue
    out.push({ x, z, s: 0.9 + rand() * 0.9, r: rand() * Math.PI * 2 })
  }
  return out
}

/** Rock outcrops on the top bench: what the pickaxe will dig first. */
function boulderPlacements(q: QuarryContent): Placement[] {
  const rand = seeded(q.forest.seed + 7)
  const { pit } = q.site
  const b2 = q.bench2
  const route = q.machines.trucks.route
  const out: Placement[] = []
  for (let i = 0; out.length < 18 && i < 400; i++) {
    const a = rand() * Math.PI * 2
    const k = Math.sqrt(rand()) * 0.9
    const s = 0.6 + rand() * 1.4
    const x = pit.x + Math.cos(a) * pit.rx * k
    const z = pit.z + Math.sin(a) * pit.rz * k
    // Keep bench 2, the haul road and the rock faces clear.
    const inBench2 = ((x - b2.pos.x) / (b2.rx + 1)) ** 2 + ((z - b2.pos.z) / (b2.rz + 1)) ** 2 < 1
    const nearRoad = route.some((p, j) => j > 0 && segmentDistance(x, z, route[j - 1]!, p) < 3)
    const nearFace = q.faces.some((f) => Math.hypot(x - f.pos.x, z - f.pos.z) < 3.2)
    if (inBench2 || nearRoad || nearFace) continue
    out.push({
      x,
      y: heightAt(q, x, z),
      z,
      s,
      sy: s * (0.6 + rand() * 0.6),
      r: rand() * Math.PI * 2,
    })
  }
  return out
}

function segmentDistance(x: number, z: number, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
}

/** A soft dark disc under the player (the device build has no real-time shadows). */
function PlayerShadow() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const { player, prevPlayer, ground } = sceneView()
    const t = tickAlpha()
    const x = lerp(prevPlayer.pos.x, player.pos.x, t)
    const z = lerp(prevPlayer.pos.z, player.pos.z, t)
    ref.current?.position.set(x, ground(x, z) + 0.04, z)
  })
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={1}>
      <circleGeometry args={[0.55, 20]} />
      <meshBasicMaterial color="#1F2A12" transparent opacity={0.25} depthWrite={false} />
    </mesh>
  )
}

/**
 * Pine Ridge before the first dig: a cleared site in a pine forest, the pit pegged out with
 * survey flags and boulders, the site office and the sign at the gate.
 */
export function QuarryWorld({ shadows = false }: { shadows?: boolean }) {
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const q = getQuarryContent(quarryId).quarry
  const geo = useMemo(
    () => ({
      pine: pineGeometry(false),
      hill: hillGeometry(),
      cabin: siteCabinGeometry(),
      sign: siteSignGeometry(),
      boulder: boulderGeometry(),
      garage: garageGeometry(),
    }),
    [],
  )
  const pines = useMemo(() => forestPlacements(q), [q])
  const boulders = useMemo(() => boulderPlacements(q), [q])
  const hills = useMemo(() => q.hills.map((h) => ({ x: h.x, z: h.z, s: h.r, sy: h.h, r: 0 })), [q])
  const c = q.site.clearing
  const { cabin, sign, garage } = q.site
  // Grass everywhere around the site, with a hole where the terrain mesh is.
  const grass = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, 220, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    // The shape is in the plane's own x/y; rotated flat, its y becomes world -z.
    hole.moveTo(c.minX, -c.minZ)
    hole.lineTo(c.minX, -c.maxZ)
    hole.lineTo(c.maxX, -c.maxZ)
    hole.lineTo(c.maxX, -c.minZ)
    hole.lineTo(c.minX, -c.minZ)
    shape.holes.push(hole)
    return new THREE.ShapeGeometry(shape, 24)
  }, [c])
  const { road } = q.buyers
  const exit = road.exit.at(-1)!
  const turn = road.exit[0]!
  return (
    <group>
      <mesh geometry={grass} rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <meshStandardMaterial color="#8DB86B" roughness={1} />
      </mesh>
      <QuarryTerrain quarry={q} />
      {/* The haul road buyers drive: in from the east, out to the south. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(road.spawnX + turn.x) / 2, 0.006, road.z]}
        receiveShadow
      >
        <planeGeometry args={[road.spawnX - turn.x + 4, 4]} />
        <meshStandardMaterial color="#9F9479" roughness={1} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[exit.x, 0.006, (turn.z + exit.z) / 2]}
        receiveShadow
      >
        <planeGeometry args={[4, exit.z - turn.z + 4]} />
        <meshStandardMaterial color="#9F9479" roughness={1} />
      </mesh>
      <Instances geometry={geo.pine} items={pines} shadows={shadows} />
      <Instances geometry={geo.hill} items={hills} />
      <Instances geometry={geo.boulder} items={boulders} shadows={shadows} />
      <mesh
        geometry={geo.cabin}
        material={propMaterial}
        position={[cabin.x, 0, cabin.z]}
        rotation-y={cabin.rotation}
        castShadow={shadows}
        receiveShadow
      />
      <mesh
        geometry={geo.garage}
        material={propMaterial}
        position={[garage.x, 0, garage.z]}
        rotation-y={garage.rotation}
        castShadow={shadows}
        receiveShadow
      />
      <mesh
        geometry={geo.sign}
        material={propMaterial}
        position={[sign.x, 0, sign.z]}
        rotation-y={Math.PI / 2}
        castShadow={shadows}
      />
      {!shadows && <PlayerShadow />}
      <QuarryLoop />
      <Effects />
      <QuarryLayoutOverlay />
    </group>
  )
}
