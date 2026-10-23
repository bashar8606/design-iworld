import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getQuarryContent } from '../../game/quarry/content.ts'
import type { QuarryContent } from '../../game/quarry/types.ts'
import { tickAlpha, useGame } from '../../store/gameStore.ts'
import { sceneView } from '../../store/view.ts'
import { lerp } from '../interp.ts'
import { propMaterial } from '../materials.ts'
import {
  boulderGeometry,
  hillGeometry,
  pineGeometry,
  siteCabinGeometry,
  siteSignGeometry,
  surveyStakeGeometry,
} from '../props/geometry.ts'

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

interface Placement {
  x: number
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
    // Keep the entrance road on the east side open.
    if (x > c.maxX && Math.abs(z - q.site.sign.z) < 3) continue
    out.push({ x, z, s: 0.9 + rand() * 0.9, r: rand() * Math.PI * 2 })
  }
  return out
}

/** Stakes with orange flags around the edge of the future pit. */
function stakePlacements(q: QuarryContent): Placement[] {
  const { pit } = q.site
  const out: Placement[] = []
  const n = 22
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push({
      x: pit.x + Math.cos(a) * pit.rx,
      z: pit.z + Math.sin(a) * pit.rz,
      s: 1,
      r: -a,
    })
  }
  return out
}

/** Rock outcrops on the top bench: what the pickaxe will dig first. */
function boulderPlacements(q: QuarryContent): Placement[] {
  const rand = seeded(q.forest.seed + 7)
  const { pit } = q.site
  const out: Placement[] = []
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2
    const k = Math.sqrt(rand()) * 0.85
    const s = 0.6 + rand() * 1.4
    out.push({
      x: pit.x + Math.cos(a) * pit.rx * k,
      z: pit.z + Math.sin(a) * pit.rz * k,
      s,
      sy: s * (0.6 + rand() * 0.6),
      r: rand() * Math.PI * 2,
    })
  }
  return out
}

/** A soft dark disc under the player (the device build has no real-time shadows). */
function PlayerShadow() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const { player, prevPlayer } = sceneView()
    const t = tickAlpha()
    ref.current?.position.set(
      lerp(prevPlayer.pos.x, player.pos.x, t),
      0.04,
      lerp(prevPlayer.pos.z, player.pos.z, t),
    )
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
      stake: surveyStakeGeometry(),
      boulder: boulderGeometry(),
    }),
    [],
  )
  const pines = useMemo(() => forestPlacements(q), [q])
  const stakes = useMemo(() => stakePlacements(q), [q])
  const boulders = useMemo(() => boulderPlacements(q), [q])
  const hills = useMemo(() => q.hills.map((h) => ({ x: h.x, z: h.z, s: h.r, sy: h.h, r: 0 })), [q])
  const c = q.site.clearing
  const { pit, cabin, sign } = q.site
  const roadZ = sign.z
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[220, 48]} />
        <meshStandardMaterial color="#8DB86B" roughness={1} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[c.maxX - c.minX, c.maxZ - c.minZ]} />
        <meshStandardMaterial color="#CDB68C" roughness={1} />
      </mesh>
      {/* The gravel access road in from the east. */}
      <mesh rotation-x={-Math.PI / 2} position={[c.maxX + 20, 0.005, roadZ]} receiveShadow>
        <planeGeometry args={[42, 4]} />
        <meshStandardMaterial color="#B8A584" roughness={1} />
      </mesh>
      {/* Where the top bench will be cut. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[pit.x, 0.01, pit.z]}
        scale={[pit.rx, pit.rz, 1]}
        receiveShadow
      >
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial color="#B49C74" roughness={1} />
      </mesh>
      <Instances geometry={geo.pine} items={pines} shadows={shadows} />
      <Instances geometry={geo.hill} items={hills} />
      <Instances geometry={geo.stake} items={stakes} />
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
        geometry={geo.sign}
        material={propMaterial}
        position={[sign.x, 0, sign.z]}
        rotation-y={Math.PI / 2}
        castShadow={shadows}
      />
      {!shadows && <PlayerShadow />}
    </group>
  )
}
