import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { cafeSpots, chargePort } from '../game/layout.ts'
import type { Vec2 } from '../game/types.ts'
import { bayDef, chargerPowerKw } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'

const MAX = 12
const WALK_SPEED = 2.6
/** Drivers only head for the café when the charge leaves time for the walk and a coffee. */
const MIN_STAY = 2
const SHIRTS = ['#F29E4C', '#E5484D', '#8FC8F0', '#A6E22E', '#F7C948', '#B48CDE', '#F7F7F2']

type Phase = 'out' | 'atCafe' | 'back'
interface Driver {
  phase: Phase
  pos: Vec2
  door: Vec2
  spot: Vec2
  heading: number
}

function step(from: Vec2, to: Vec2, dist: number): { pos: Vec2; arrived: boolean } {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  if (d <= dist) return { pos: { ...to }, arrived: true }
  return { pos: { x: from.x + (dx / d) * dist, z: from.z + (dz / d) * dist }, arrived: false }
}

/**
 * Drivers of charging cars walk to the café, wait at the counter and walk back with a coffee
 * before their car is full. Purely visual: the spending itself is settled in the simulation.
 */
export function Drivers() {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const cups = useRef<THREE.InstancedMesh>(null)
  const drivers = useRef(new Map<number, Driver>())
  const geometry = useMemo(
    () => ({
      body: new THREE.CapsuleGeometry(0.2, 0.45, 3, 8).translate(0, 0.52, 0),
      head: new THREE.SphereGeometry(0.17, 10, 8).translate(0, 1.08, 0),
      cup: new THREE.CylinderGeometry(0.06, 0.05, 0.14, 8).translate(0.22, 0.62, 0.12),
    }),
    [],
  )
  const materials = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      head: new THREE.MeshStandardMaterial({ color: '#E8B48A', roughness: 0.9 }),
      cup: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6 }),
    }),
    [],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const color = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }, dt) => {
    const { state, prev } = useGame.getState()
    const content = getContent(state.mapId)
    const cafePad = content.map.pads.find((p) => p.kind === 'cafe')
    const list = drivers.current
    if (!state.facilities.cafe || !cafePad) list.clear()
    const spots = cafePad ? cafeSpots(cafePad.pos) : []
    const kwh = content.map.energy.kwhPerKwSecond

    // Charging cars with time to spare send their driver to the café.
    const prevCars = new Map(prev.cars.map((c) => [c.id, c]))
    for (const car of state.cars) {
      if (!cafePad || !state.facilities.cafe || car.phase !== 'charging' || !car.bayId) continue
      const charger = state.chargers.find((c) => c.carId === car.id)
      const before = prevCars.get(car.id)
      const observed = before ? (car.energyDelivered - before.energyDelivered) / 0.1 : 0
      const rate = observed > 1e-3 ? observed : charger ? chargerPowerKw(charger, content) * kwh : 0
      const remaining = rate > 0 ? (car.energyNeeded - car.energyDelivered) / rate : Infinity
      let driver = list.get(car.id)
      if (!driver) {
        const used = new Set([...list.values()].map((d) => `${d.spot.x},${d.spot.z}`))
        const spot = spots.find((s) => !used.has(`${s.x},${s.z}`))
        const bay = bayDef(content.map, car.bayId)
        // The driver's door: just behind the front wheel on the left, outside the car.
        const port = chargePort(bay, content, car.type)
        const door = { x: port.x - 0.6, z: port.z - 0.5 }
        const walk = Math.hypot(spot ? spot.x - door.x : 0, spot ? spot.z - door.z : 0) / WALK_SPEED
        if (!spot || list.size >= MAX || remaining < 2 * walk + MIN_STAY) continue
        driver = { phase: 'out', pos: { ...door }, door, spot, heading: 0 }
        list.set(car.id, driver)
      }
      // Head back in time to drive off with the car.
      const back =
        Math.hypot(driver.door.x - driver.pos.x, driver.door.z - driver.pos.z) / WALK_SPEED
      if (driver.phase !== 'back' && remaining <= back + 0.6) driver.phase = 'back'
    }

    // Move, and drop drivers whose car has gone or who are back at the door.
    for (const [carId, d] of list) {
      const car = state.cars.find((c) => c.id === carId)
      if (!car || (car.phase !== 'charging' && d.phase !== 'back')) {
        list.delete(carId)
        continue
      }
      if (d.phase === 'atCafe') continue
      const target = d.phase === 'out' ? d.spot : d.door
      const next = step(d.pos, target, WALK_SPEED * dt)
      if (Math.hypot(next.pos.x - d.pos.x, next.pos.z - d.pos.z) > 1e-4) {
        d.heading = Math.atan2(next.pos.x - d.pos.x, next.pos.z - d.pos.z)
      }
      d.pos = next.pos
      if (next.arrived) {
        if (d.phase === 'out') {
          d.phase = 'atCafe'
          d.heading = Math.PI // face the serving window
        } else list.delete(carId)
      }
    }

    // Draw.
    const t = clock.elapsedTime
    let i = 0
    let c = 0
    for (const [carId, d] of list) {
      const walking = d.phase !== 'atCafe'
      const bob = walking ? Math.abs(Math.sin(t * 9 + carId)) * 0.07 : 0
      q.setFromAxisAngle(up, d.heading)
      m4.compose(new THREE.Vector3(d.pos.x, bob, d.pos.z), q, new THREE.Vector3(1, 1, 1))
      bodies.current!.setMatrixAt(i, m4)
      bodies.current!.setColorAt(i, color.set(SHIRTS[carId % SHIRTS.length]!))
      heads.current!.setMatrixAt(i, m4)
      if (d.phase === 'back') cups.current!.setMatrixAt(c++, m4)
      i++
    }
    for (const [mesh, count] of [
      [bodies.current!, i],
      [heads.current!, i],
      [cups.current!, c],
    ] as const) {
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh
        ref={bodies}
        args={[geometry.body, materials.body, MAX]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={heads}
        args={[geometry.head, materials.head, MAX]}
        castShadow
        frustumCulled={false}
      />
      <instancedMesh ref={cups} args={[geometry.cup, materials.cup, MAX]} frustumCulled={false} />
    </>
  )
}
