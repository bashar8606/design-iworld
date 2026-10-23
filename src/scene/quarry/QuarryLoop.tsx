import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getQuarryContent } from '../../game/quarry/content.ts'
import { quarryHint } from '../../game/quarry/hint.ts'
import { faceInReach } from '../../game/quarry/tick.ts'
import type { QuarryContent, QuarryState, QuarryUpgradeId } from '../../game/quarry/types.ts'
import { tickAlpha, useGame } from '../../store/gameStore.ts'
import { lerp, lerpAngle } from '../interp.ts'
import { glowTeal, propMaterial } from '../materials.ts'
import { PadMarker } from '../Pads.tsx'
import { Pickups } from '../Pickups.tsx'
import {
  boulderGeometry,
  conveyorSectionGeometry,
  crusherGeometry,
  pickupGeometry,
} from '../props/geometry.ts'

const GRAVEL = '#A9A196'
const m4 = new THREE.Matrix4()
const v3 = new THREE.Vector3()
const q4 = new THREE.Quaternion()
const s3 = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)

function quarryNow(): { q: QuarryState; prev: QuarryState } | null {
  const { quarry, quarryPrev } = useGame.getState()
  return quarry ? { q: quarry, prev: quarryPrev ?? quarry } : null
}

function useQuarryContent(): QuarryContent {
  const id = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  return getQuarryContent(id).quarry
}

/** Each face is a cluster of boulders that shrinks as it is mined and grows back. */
const CLUSTER: [number, number, number, number][] = [
  // dx, dz, scale, yaw
  [0, 0, 1.25, 0],
  [0.95, -0.35, 0.9, 1.2],
  [-0.9, -0.25, 0.85, 2.4],
  [0.2, -0.95, 1.0, 0.7],
  [-0.35, 0.7, 0.7, 1.9],
]

function RockFaces() {
  const quarry = useQuarryContent()
  const ref = useRef<THREE.InstancedMesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => boulderGeometry(), [])
  const count = quarry.faces.length * CLUSTER.length
  useFrame(({ clock }) => {
    const now = quarryNow()
    const mesh = ref.current
    if (!now || !mesh) return
    let i = 0
    for (const f of quarry.faces) {
      const k = Math.max(0.3, Math.sqrt((now.q.faces[f.id] ?? 0) / f.rocks))
      for (const [dx, dz, sc, yaw] of CLUSTER) {
        q4.setFromAxisAngle(up, yaw)
        s3.set(sc * k * 1.3, sc * k * 1.3, sc * k * 1.3)
        mesh.setMatrixAt(i++, m4.compose(v3.set(f.pos.x + dx, 0.15, f.pos.z + dz), q4, s3))
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    // A glowing ring under the face the pickaxe is working on.
    const face = faceInReach(now.q, quarry)
    const def = quarry.faces.find((f) => f.id === face)
    if (ring.current) {
      ring.current.visible = !!def
      if (def) {
        ring.current.position.set(def.pos.x, 0.04, def.pos.z)
        ring.current.scale.setScalar(1 + 0.06 * Math.sin(clock.elapsedTime * 10))
      }
    }
  })
  return (
    <>
      <instancedMesh ref={ref} args={[geometry, propMaterial, count]} castShadow receiveShadow />
      <mesh ref={ring} rotation-x={-Math.PI / 2} material={glowTeal}>
        <ringGeometry args={[1.7, 1.9, 32]} />
      </mesh>
    </>
  )
}

/** The rocks the player carries, stacked on their back. */
function CarryStack() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => boulderGeometry().scale(0.32, 0.32, 0.32), [])
  const heading = useRef(0)
  const MAX = 16
  useFrame((_, dt) => {
    const now = quarryNow()
    const mesh = ref.current
    if (!now || !mesh) return
    const t = tickAlpha()
    const x = lerp(now.prev.player.pos.x, now.q.player.pos.x, t)
    const z = lerp(now.prev.player.pos.z, now.q.player.pos.z, t)
    heading.current = lerpAngle(heading.current, now.q.player.heading, 1 - Math.exp(-14 * dt))
    const bx = x - Math.sin(heading.current) * 0.42
    const bz = z - Math.cos(heading.current) * 0.42
    const n = Math.min(MAX, now.q.player.carry)
    for (let i = 0; i < n; i++) {
      q4.setFromAxisAngle(up, i * 1.7)
      const off = ((i % 2) - 0.5) * 0.12
      mesh.setMatrixAt(
        i,
        m4.compose(v3.set(bx + off, 0.9 + i * 0.16, bz - off), q4, s3.set(1, 1, 1)),
      )
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, propMaterial, MAX]}
      castShadow
      frustumCulled={false}
    />
  )
}

/** The crusher: it shudders while it works, and rock shows in the hopper. */
function Crusher() {
  const quarry = useQuarryContent()
  const { pos, hopper, hopperTons } = quarry.crusher
  const body = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => crusherGeometry(), [])
  useFrame(({ clock }) => {
    const now = quarryNow()
    if (!now) return
    const working = now.q.hopper > 1e-3
    if (body.current)
      body.current.position.set(
        pos.x + (working ? 0.025 * Math.sin(clock.elapsedTime * 55) : 0),
        0,
        pos.z,
      )
    if (fill.current) {
      const f = Math.min(1, now.q.hopper / hopperTons)
      fill.current.visible = f > 0.01
      fill.current.scale.set(0.6 + 0.9 * f, 0.15 + 0.6 * f, 0.6 + 0.9 * f)
      fill.current.position.set(hopper.x, 2.7 + 0.35 * f, hopper.z)
    }
  })
  return (
    <>
      <group ref={body} position={[pos.x, 0, pos.z]}>
        <mesh geometry={geometry} material={propMaterial} castShadow receiveShadow />
      </group>
      <mesh ref={fill} rotation-y={Math.PI / 4}>
        <cylinderGeometry args={[0.9, 0.5, 1, 4]} />
        <meshStandardMaterial color="#8E877C" roughness={1} flatShading />
      </mesh>
    </>
  )
}

const BELT_START_Y = 1.1
const BELT_END_Y = 3.0

/** The conveyor from the crusher to the top of the pile, with gravel riding it. */
function Conveyor() {
  const quarry = useQuarryContent()
  const { pos, beltEnd, beltSeconds } = quarry.crusher
  const start = useMemo(() => new THREE.Vector3(pos.x, BELT_START_Y, pos.z + 1.3), [pos])
  const end = useMemo(() => new THREE.Vector3(beltEnd.x, BELT_END_Y, beltEnd.z), [beltEnd])
  const section = useMemo(() => conveyorSectionGeometry(), [])
  const length = start.distanceTo(end)
  const sections = Math.ceil(length)
  const orient = useMemo(() => {
    const dir = end.clone().sub(start).normalize()
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
  }, [start, end])
  const beltRef = useRef<THREE.InstancedMesh>(null)
  const bits = useRef<THREE.InstancedMesh>(null)
  const bitGeometry = useMemo(() => new THREE.BoxGeometry(0.22, 0.14, 0.22), [])
  useFrame(() => {
    const mesh = beltRef.current
    if (mesh && mesh.userData.placed !== length) {
      for (let i = 0; i < sections; i++) {
        v3.copy(start).lerp(end, (i + 0.5) / sections)
        mesh.setMatrixAt(i, m4.compose(v3, orient, s3.set(1, 1, length / sections)))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.userData.placed = length
    }
    const now = quarryNow()
    const b = bits.current
    if (!now || !b) return
    let i = 0
    for (const batch of now.q.belt) {
      const p = 1 - (batch.at - now.q.time) / beltSeconds
      const n = Math.min(6, Math.ceil(batch.tons * 6))
      for (let k = 0; k < n && i < 60; k++) {
        const t = Math.max(0, Math.min(1, p - k * 0.025))
        v3.copy(start).lerp(end, t)
        v3.y += 0.1
        q4.setFromAxisAngle(up, k + batch.at)
        b.setMatrixAt(i++, m4.compose(v3, q4, s3.set(1, 1, 1)))
      }
    }
    b.count = i
    b.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={beltRef} args={[section, propMaterial, sections]} castShadow />
      {/* Legs under the high end. */}
      <mesh position={[end.x, (BELT_END_Y - 0.1) / 2, end.z - 0.9]} castShadow>
        <boxGeometry args={[0.16, BELT_END_Y - 0.1, 0.16]} />
        <meshStandardMaterial color="#F7C948" />
      </mesh>
      <instancedMesh ref={bits} args={[bitGeometry, undefined, 60]} frustumCulled={false}>
        <meshStandardMaterial color={GRAVEL} roughness={1} />
      </instancedMesh>
    </>
  )
}

/** The gravel pile: a cone that grows with the tons on it. */
function GravelPile() {
  const quarry = useQuarryContent()
  const pile = quarry.stockpiles[0]!
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const now = quarryNow()
    const mesh = ref.current
    if (!now || !mesh) return
    const f = Math.min(1, (now.q.piles[pile.id] ?? 0) / pile.capacityTons)
    mesh.visible = f > 0.002
    const r = 0.5 + 2.0 * Math.cbrt(f)
    mesh.scale.set(r, r * 0.62, r)
  })
  return (
    <>
      <mesh ref={ref} position={[pile.pos.x, 0, pile.pos.z]} castShadow receiveShadow>
        <coneGeometry args={[1, 1, 9]} />
        <meshStandardMaterial color={GRAVEL} roughness={1} flatShading />
      </mesh>
      {/* The pad the pile sits on. */}
      <mesh rotation-x={-Math.PI / 2} position={[pile.pos.x, 0.012, pile.pos.z]} receiveShadow>
        <circleGeometry args={[2.7, 28]} />
        <meshStandardMaterial color="#B5AA95" roughness={1} />
      </mesh>
    </>
  )
}

/** Buyer pickups on the road, with gravel showing in the bed as they load. */
function Buyers() {
  const quarry = useQuarryContent()
  const ids = useGame(useShallow((s) => s.quarry?.buyers.map((b) => b.id) ?? []))
  return (
    <>
      {ids.map((id) => (
        <Buyer key={id} id={id} quarry={quarry} />
      ))}
    </>
  )
}

function Buyer({ id, quarry }: { id: number; quarry: QuarryContent }) {
  const group = useRef<THREE.Group>(null)
  const load = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => pickupGeometry(), [])
  const heading = useRef<number | null>(null)
  useFrame((_, dt) => {
    const now = quarryNow()
    const g = group.current
    if (!now || !g) return
    const b = now.q.buyers.find((x) => x.id === id)
    if (!b) return
    const p = now.prev.buyers.find((x) => x.id === id) ?? b
    const t = tickAlpha()
    g.position.set(lerp(p.pos.x, b.pos.x, t), 0, lerp(p.pos.z, b.pos.z, t))
    heading.current =
      heading.current === null
        ? b.heading
        : lerpAngle(heading.current, b.heading, 1 - Math.exp(-8 * dt))
    g.rotation.y = heading.current
    const type = quarry.buyers.types.find((x) => x.id === b.type) ?? quarry.buyers.types[0]!
    const f = Math.min(1, b.loaded / type.loadTons)
    if (load.current) {
      load.current.visible = f > 0.01
      load.current.scale.set(1, 0.05 + f, 1)
    }
  })
  return (
    <group ref={group}>
      <mesh geometry={geometry} material={propMaterial} castShadow />
      <mesh ref={load} position={[0, 0.92, -1.2]}>
        <boxGeometry args={[1.6, 0.5, 1.8]} />
        <meshStandardMaterial color={GRAVEL} roughness={1} />
      </mesh>
    </group>
  )
}

/** Pads for the next level of each upgrade. */
function UpgradePads() {
  const quarry = useQuarryContent()
  const pads = useGame(
    useShallow((s) =>
      (Object.keys(quarry.upgrades) as QuarryUpgradeId[]).map((id) => {
        const price = quarry.upgrades[id].prices[s.quarry?.levels[id] ?? 0]
        return `${id}:${price ?? ''}:${Math.floor(s.quarry?.paid[id] ?? 0)}`
      }),
    ),
  )
  return (
    <>
      {pads.map((key) => {
        const [id, price, paid] = key.split(':') as [QuarryUpgradeId, string, string]
        if (!price) return null
        const def = quarry.upgrades[id]
        return (
          <PadMarker
            key={id}
            pos={def.pad}
            icon={def.icon}
            price={Number(price)}
            paid={Number(paid)}
            accent="#F2B705"
          />
        )
      })}
    </>
  )
}

/** A bouncing arrow over the next thing to do. */
function HintArrow() {
  const quarry = useQuarryContent()
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const now = quarryNow()
    const g = ref.current
    if (!now || !g) return
    // Only for the first few minutes: by then the loop is second nature.
    const target = now.q.stats.totalEarned < 150 ? quarryHint(now.q, quarry).target : null
    g.visible = !!target
    if (!target) return
    g.position.set(target.x, 2.8 + 0.35 * Math.sin(clock.elapsedTime * 5), target.z)
    g.rotation.y = clock.elapsedTime * 1.5
  })
  return (
    <group ref={ref}>
      <mesh rotation-x={Math.PI}>
        <coneGeometry args={[0.45, 0.9, 4]} />
        <meshStandardMaterial color="#F7C948" emissive="#F29E4C" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        <meshStandardMaterial color="#F7C948" emissive="#F29E4C" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

const quarryStacks = () => useGame.getState().quarry?.stacks ?? []

/** Everything that moves in the quarry's loop. */
export function QuarryLoop() {
  return (
    <>
      <RockFaces />
      <CarryStack />
      <Crusher />
      <Conveyor />
      <GravelPile />
      <Buyers />
      <UpgradePads />
      <Pickups stacks={quarryStacks} />
      <HintArrow />
    </>
  )
}
