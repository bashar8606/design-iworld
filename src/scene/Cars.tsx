import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import type { Car } from '../game/types.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import { FACE_CAMERA } from './billboard.ts'
import { lerp, lerpAngle } from './interp.ts'
import { type ModelName, useModelGeometry } from './models/useModelGeometry.ts'

const MAX_PER_MODEL = 40
const CAR_MODELS: ModelName[] = ['hatchback', 'sedan', 'taxi', 'scooter']
const VIP_TINT = new THREE.Color('#FFE08A')
const WHITE = new THREE.Color('#FFFFFF')

const m4 = new THREE.Matrix4()
const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const scale = new THREE.Vector3(1, 1, 1)
const up = new THREE.Vector3(0, 1, 0)

/** Interpolated position and heading of a car between the previous and latest tick. */
function carPose(car: Car, prev: Car | undefined, t: number) {
  if (!prev) return { x: car.pos.x, z: car.pos.z, heading: car.heading }
  return {
    x: lerp(prev.pos.x, car.pos.x, t),
    z: lerp(prev.pos.z, car.pos.z, t),
    heading: lerpAngle(prev.heading, car.heading, t),
  }
}

export function Cars() {
  return (
    <>
      {CAR_MODELS.map((model) => (
        <CarInstances key={model} model={model} />
      ))}
      <CarRings />
    </>
  )
}

function CarInstances({ model }: { model: ModelName }) {
  const { geometry, material } = useModelGeometry(model)
  const ref = useRef<THREE.InstancedMesh>(null)
  const carTypes = useMemo(() => getContent('map1').cars, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { state, prev } = useGame.getState()
    const t = tickAlpha()
    const prevById = new Map(prev.cars.map((c) => [c.id, c]))
    let i = 0
    for (const car of state.cars) {
      if ((carTypes[car.type]?.model ?? 'hatchback') !== model || i >= MAX_PER_MODEL) continue
      const p = carPose(car, prevById.get(car.id), t)
      pos.set(p.x, 0, p.z)
      // Models face -Z; the simulation's heading 0 faces +Z.
      quat.setFromAxisAngle(up, p.heading + Math.PI)
      mesh.setMatrixAt(i, m4.compose(pos, quat, scale))
      mesh.setColorAt(i, car.vip ? VIP_TINT : WHITE)
      i++
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, MAX_PER_MODEL]}
      castShadow
      frustumCulled={false}
    />
  )
}

const PATIENCE_FULL = new THREE.Color('#19B5A5')
const PATIENCE_EMPTY = new THREE.Color('#E5484D')
const CHARGING = new THREE.Color('#A6E22E')

/** A ring over each waiting car (teal → red as patience runs out) or charging car (lime, grows). */
function CarRings() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.RingGeometry(0.32, 0.5, 20), [])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, transparent: true }),
    [],
  )
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const { state, prev } = useGame.getState()
    const t = tickAlpha()
    const prevById = new Map(prev.cars.map((c) => [c.id, c]))
    let i = 0
    for (const car of state.cars) {
      const waiting = car.phase === 'queue' || car.phase === 'waiting' || car.phase === 'toBay'
      const charging = car.phase === 'charging'
      if (!waiting && !charging) continue
      const p = carPose(car, prevById.get(car.id), t)
      let s: number
      if (waiting) {
        const f = Math.max(0, car.patience / car.patienceMax)
        color.copy(PATIENCE_EMPTY).lerp(PATIENCE_FULL, f)
        s = f < 0.3 ? 1 + 0.15 * Math.sin(clock.elapsedTime * 12) : 1
      } else {
        color.copy(CHARGING)
        s = 0.4 + 0.6 * Math.min(1, car.energyDelivered / car.energyNeeded)
      }
      pos.set(p.x, 2.6, p.z)
      scale.set(s, s, s)
      mesh.setMatrixAt(i, m4.compose(pos, FACE_CAMERA, scale))
      mesh.setColorAt(i, color)
      i++
    }
    scale.set(1, 1, 1)
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, 60]}
      frustumCulled={false}
      renderOrder={10}
    />
  )
}
