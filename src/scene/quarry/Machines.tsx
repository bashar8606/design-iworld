import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getQuarryContent } from '../../game/quarry/content.ts'
import { routeLength } from '../../game/quarry/route.ts'
import { heightAt, routeHeight, routePoint } from '../../game/quarry/terrain.ts'
import { sceneView } from '../../store/view.ts'
import { openQuarryPads, truckCapacity } from '../../game/quarry/state.ts'
import type { QuarryContent, QuarryState, Truck } from '../../game/quarry/types.ts'
import { onGameEvent } from '../../store/events.ts'
import { tickAlpha, useGame } from '../../store/gameStore.ts'
import { damp, lerp, lerpAngle } from '../interp.ts'
import { propMaterial } from '../materials.ts'
import { Worker } from '../models/generated/index.ts'
import { PadMarker } from '../Pads.tsx'
import {
  drillRigGeometry,
  dumpBodyGeometry,
  dumpTruckGeometry,
  excavatorBaseGeometry,
  excavatorUpperGeometry,
  surveyStakeGeometry,
  wheelLoaderGeometry,
} from '../props/geometry.ts'

const ROCK = '#8E877C'
/** Machines are drawn a little under life size so they fit the arcade view. */
const MACHINE_SCALE = 0.72

function quarryNow(): { q: QuarryState; prev: QuarryState } | null {
  const { quarry, quarryPrev } = useGame.getState()
  return quarry ? { q: quarry, prev: quarryPrev ?? quarry } : null
}

function useQuarryContent(): QuarryContent {
  const id = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  return getQuarryContent(id).quarry
}

const useBuilt = (id: string) => useGame((s) => s.quarry?.pads[id]?.built ?? false)

/** Bench 2: pegged out until it is bought; the terrain mesh digs it (and the ramp) out. */
function Bench2() {
  const quarry = useQuarryContent()
  const open = useBuilt('bench2')
  const { pos, rx, rz } = quarry.bench2
  const stake = useMemo(() => surveyStakeGeometry(), [])
  const stakes = useRef<THREE.InstancedMesh>(null)
  const n = 18
  useEffect(() => {
    const mesh = stakes.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = pos.x + Math.cos(a) * rx
      const z = pos.z + Math.sin(a) * rz
      m.makeRotationY(-a).setPosition(x, heightAt(quarry, x, z, 0), z)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [open, pos, rx, rz, quarry])
  if (!open) return <instancedMesh ref={stakes} args={[stake, propMaterial, n]} />
  return (
    <>
      <RockPiles />
    </>
  )
}

/** Blasted rock at the excavator's face, and dug rock waiting at the loading spot. */
function RockPiles() {
  const quarry = useQuarryContent()
  const broken = useRef<THREE.Mesh>(null)
  const buffer = useRef<THREE.Mesh>(null)
  const ex = quarry.machines.excavator
  const face = ex.facePile
  const buf = ex.bufferPile
  useFrame(() => {
    const now = quarryNow()
    if (!now) return
    const b = broken.current
    if (b) {
      const f = Math.min(1, now.q.broken / ex.maxBrokenTons)
      b.visible = f > 0.01
      const r = 0.8 + 1.8 * Math.cbrt(f)
      b.scale.set(r, r * 0.55, r)
    }
    const u = buffer.current
    if (u) {
      const f = Math.min(1, now.q.digBuffer / ex.bufferTons)
      u.visible = f > 0.02
      const r = 0.4 + 1.0 * Math.cbrt(f)
      u.scale.set(r, r * 0.6, r)
    }
  })
  return (
    <>
      <mesh
        ref={broken}
        position={[face.x, heightAt(quarry, face.x, face.z), face.z]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color={ROCK} roughness={1} flatShading />
      </mesh>
      <mesh
        ref={buffer}
        position={[buf.x, heightAt(quarry, buf.x, buf.z), buf.z]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color={ROCK} roughness={1} flatShading />
      </mesh>
    </>
  )
}

function Loader() {
  const quarry = useQuarryContent()
  const built = useBuilt('loader')
  const group = useRef<THREE.Group>(null)
  const bucket = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => wheelLoaderGeometry(), [])
  const heading = useRef<number | null>(null)
  useFrame((_, dt) => {
    const now = quarryNow()
    const g = group.current
    const l = now?.q.loader
    if (!now || !g || !l) return
    const p = now.prev.loader ?? l
    const t = tickAlpha()
    const x = lerp(p.pos.x, l.pos.x, t)
    const z = lerp(p.pos.z, l.pos.z, t)
    g.position.set(x, heightAt(quarry, x, z), z)
    heading.current =
      heading.current === null
        ? l.heading
        : lerpAngle(heading.current, l.heading, 1 - Math.exp(-6 * dt))
    g.rotation.y = heading.current
    if (bucket.current) bucket.current.visible = l.load > 0
  })
  if (!built) return null
  return (
    <group ref={group} scale={MACHINE_SCALE}>
      <mesh geometry={geometry} material={propMaterial} castShadow />
      <mesh ref={bucket} position={[0, 0.85, 2.15]}>
        <boxGeometry args={[1.5, 0.45, 0.45]} />
        <meshStandardMaterial color={ROCK} roughness={1} flatShading />
      </mesh>
    </group>
  )
}

function Excavator() {
  const quarry = useQuarryContent()
  const built = useBuilt('excavator')
  const upper = useRef<THREE.Group>(null)
  const base = useMemo(() => excavatorBaseGeometry(), [])
  const top = useMemo(() => excavatorUpperGeometry(), [])
  const { pos } = quarry.machines.excavator
  const load = quarry.machines.trucks.route[0]!
  // Facing the loading spot; it swings between the rock face and the truck.
  const toTruck = Math.atan2(load.x - pos.x, load.z - pos.z)
  const fp = quarry.machines.excavator.facePile
  const toFace = Math.atan2(fp.x - pos.x, fp.z - pos.z)
  useFrame(({ clock }) => {
    const now = quarryNow()
    const g = upper.current
    if (!now || !g) return
    const digging = now.q.digBuffer < quarry.machines.excavator.bufferTons - 1e-3
    const k = digging ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.4) : 1
    g.rotation.y = toFace + (toTruck - toFace) * k
  })
  if (!built) return null
  return (
    <group position={[pos.x, heightAt(quarry, pos.x, pos.z), pos.z]} scale={MACHINE_SCALE}>
      <mesh geometry={base} material={propMaterial} rotation-y={toTruck} castShadow />
      <group ref={upper}>
        <mesh geometry={top} material={propMaterial} castShadow />
      </group>
    </group>
  )
}

function DrillRig() {
  const quarry = useQuarryContent()
  const built = useBuilt('drill')
  const geometry = useMemo(() => drillRigGeometry(), [])
  const { pos } = quarry.machines.drill
  if (!built) return null
  return (
    <mesh
      geometry={geometry}
      material={propMaterial}
      position={[pos.x, heightAt(quarry, pos.x, pos.z), pos.z]}
      rotation-y={0.6}
      scale={MACHINE_SCALE}
      castShadow
    />
  )
}

/** A rising, fading dust cloud wherever the drill rig blasts. */
function BlastDust() {
  const group = useRef<THREE.Group>(null)
  const puffs = useRef<{ mesh: THREE.Mesh; life: number; vel: THREE.Vector3 }[]>([])
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])
  useEffect(
    () =>
      onGameEvent((e) => {
        if (e.type !== 'blast' || !group.current) return
        for (let i = 0; i < 14; i++) {
          const material = new THREE.MeshStandardMaterial({
            color: '#D8CBB0',
            transparent: true,
            opacity: 0.85,
            roughness: 1,
            flatShading: true,
          })
          const mesh = new THREE.Mesh(geometry, material)
          const a = (i / 14) * Math.PI * 2
          const ground = sceneView().ground(e.pos.x, e.pos.z)
          mesh.position.set(e.pos.x + Math.cos(a) * 0.8, ground + 0.6, e.pos.z + Math.sin(a) * 0.8)
          mesh.scale.setScalar(0.6 + Math.random() * 0.5)
          group.current.add(mesh)
          puffs.current.push({
            mesh,
            life: 2.2,
            vel: new THREE.Vector3(Math.cos(a) * 1.6, 2 + Math.random() * 1.5, Math.sin(a) * 1.6),
          })
        }
      }),
    [geometry],
  )
  useFrame((_, dt) => {
    puffs.current = puffs.current.filter((p) => {
      p.life -= dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.vel.multiplyScalar(1 - 1.5 * dt)
      p.mesh.scale.multiplyScalar(1 + 0.9 * dt)
      ;(p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.life / 2.2) * 0.85
      if (p.life > 0) return true
      p.mesh.removeFromParent()
      ;(p.mesh.material as THREE.Material).dispose()
      return false
    })
  })
  return <group ref={group} />
}

function Trucks() {
  const quarry = useQuarryContent()
  const ids = useGame(useShallow((s) => s.quarry?.trucks.map((t) => t.id) ?? []))
  return (
    <>
      {ids.map((id) => (
        <DumpTruck key={id} id={id} quarry={quarry} />
      ))}
    </>
  )
}

/** Where a truck is drawn: on its lane of the haul road, or parked beside its pad. */
function truckPose(
  t: Truck,
  quarry: QuarryContent,
): { x: number; y: number; z: number; heading: number; pitch: number } {
  const def = quarry.machines.trucks
  if (t.phase === 'parked') {
    const pad = quarry.pads.find((p) => p.id === t.id)!
    return { x: pad.pos.x, y: 0, z: pad.pos.z - 2.4, heading: Math.PI / 2, pitch: 0 }
  }
  const toTip = t.phase === 'hauling' || t.phase === 'tipping'
  const d = Math.min(t.d, routeLength(def.route))
  const { pos, heading, y } = routePoint(quarry, d)
  const grade = (routeHeight(quarry, d + 0.5) - routeHeight(quarry, d - 0.5)) / 1
  const side = toTip ? 1 : -1
  // Drive on the right: offset to the right of the direction of travel.
  const dir = toTip ? heading : heading + Math.PI
  return {
    x: pos.x + Math.cos(heading) * def.laneOffset * side,
    y,
    z: pos.z - Math.sin(heading) * def.laneOffset * side,
    heading: dir,
    // Nose up climbing out, nose down going back down.
    pitch: Math.atan(grade) * (toTip ? -1 : 1),
  }
}

function DumpTruck({ id, quarry }: { id: string; quarry: QuarryContent }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const load = useRef<THREE.Mesh>(null)
  const chassis = useMemo(() => dumpTruckGeometry(), [])
  const bed = useMemo(() => dumpBodyGeometry(), [])
  const heading = useRef<number | null>(null)
  const tilt = useRef(0)
  useFrame((_, dt) => {
    const now = quarryNow()
    const g = group.current
    if (!now || !g) return
    const t = now.q.trucks.find((x) => x.id === id)
    if (!t) return
    const p = now.prev.trucks.find((x) => x.id === id) ?? t
    const a = truckPose(p, quarry)
    const b = truckPose(t, quarry)
    const k = tickAlpha()
    g.position.set(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k))
    heading.current =
      heading.current === null
        ? b.heading
        : lerpAngle(heading.current, b.heading, 1 - Math.exp(-6 * dt))
    g.rotation.set(lerp(a.pitch, b.pitch, k), heading.current, 0, 'YXZ')
    tilt.current = damp(tilt.current, t.phase === 'tipping' ? 0.75 : 0, 4, dt)
    if (body.current) body.current.rotation.x = -tilt.current
    if (load.current) {
      const f = Math.min(1, t.load / truckCapacity(now.q, quarry))
      load.current.visible = f > 0.01
      load.current.scale.set(1, 0.1 + f, 1)
    }
  })
  return (
    <group ref={group} scale={MACHINE_SCALE}>
      <mesh geometry={chassis} material={propMaterial} castShadow />
      <group ref={body} position={[0, 1.15, -3.1]}>
        <mesh geometry={bed} material={propMaterial} castShadow />
        <mesh ref={load} position={[0, 0.5, 1.7]}>
          <boxGeometry args={[1.8, 0.7, 3.0]} />
          <meshStandardMaterial color={ROCK} roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  )
}

/** The operator, foreman and mechanic at their posts. */
function Staff() {
  const quarry = useQuarryContent()
  const operator = useBuilt('operator')
  const foreman = useBuilt('foreman')
  const mechanic = useBuilt('mechanic')
  const pad = (id: string) => quarry.pads.find((p) => p.id === id)!.pos
  const counter = quarry.office.counter
  return (
    <>
      {operator && (
        <Worker
          animation="Idle"
          position={[pad('operator').x, 0, pad('operator').z]}
          rotation-y={-2.4}
        />
      )}
      {foreman && <Worker animation="Idle" position={[counter.x - 0.8, 0, counter.z - 0.6]} />}
      {mechanic && (
        <Worker
          animation="Idle"
          position={[pad('mechanic').x, 0, pad('mechanic').z - 1.6]}
          rotation-y={0.8}
        />
      )}
    </>
  )
}

/** Pads for machines, people and land the player can buy next. */
function MachinePads() {
  const quarry = useQuarryContent()
  const pads = useGame(
    useShallow((s) =>
      s.quarry
        ? openQuarryPads(s.quarry, quarry).map(
            (p) => `${p.id}:${Math.floor(s.quarry!.pads[p.id]?.paid ?? 0)}`,
          )
        : [],
    ),
  )
  return (
    <>
      {pads.map((key) => {
        const [id, paid] = key.split(':') as [string, string]
        const pad = quarry.pads.find((p) => p.id === id)!
        return (
          <PadMarker
            key={id}
            pos={pad.pos}
            y={heightAt(quarry, pad.pos.x, pad.pos.z)}
            icon={pad.icon}
            price={pad.price}
            paid={Number(paid)}
            accent={pad.kind === 'land' ? '#F29E4C' : '#19B5A5'}
            size={pad.kind === 'land' ? 2.4 : 2.1}
          />
        )
      })}
    </>
  )
}

export function Machines() {
  return (
    <>
      <Bench2 />
      <Loader />
      <Excavator />
      <DrillRig />
      <BlastDust />
      <Trucks />
      <Staff />
      <MachinePads />
    </>
  )
}
