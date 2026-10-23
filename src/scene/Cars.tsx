import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import type { Car, GameState } from '../game/types.ts'
import { chargerPowerKw } from '../game/world.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import { formatDuration } from '../ui/format.ts'
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
      <CarBubbles />
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

type Bubble =
  | { kind: 'none' }
  | { kind: 'charge'; percent: number; seconds: number; stalled: boolean }
  | { kind: 'mood'; emoji: string; urgent: boolean }

/** What the bubble over a car shows: charge progress, or how the driver feels. */
function carBubble(state: GameState, id: number): Bubble {
  const car = state.cars.find((c) => c.id === id)
  if (!car) return { kind: 'none' }
  if (car.phase === 'charging') {
    const content = getContent(state.mapId)
    const charger = state.chargers.find((c) => c.carId === id)
    const kw = charger ? chargerPowerKw(charger, content) : 0
    const remaining = Math.max(0, car.energyNeeded - car.energyDelivered)
    return {
      kind: 'charge',
      percent: Math.floor((car.energyDelivered / car.energyNeeded) * 100),
      seconds: kw > 0 ? Math.ceil(remaining / (kw * content.map.energy.kwhPerKwSecond)) : 0,
      stalled: state.energy.blackout,
    }
  }
  if (car.phase === 'angry') return { kind: 'mood', emoji: '😡', urgent: false }
  if (car.phase === 'leaving') return { kind: 'mood', emoji: '😍', urgent: false }
  const f = car.patience / car.patienceMax
  return f > 0.6
    ? { kind: 'mood', emoji: '🙂', urgent: false }
    : f > 0.3
      ? { kind: 'mood', emoji: '😐', urgent: false }
      : { kind: 'mood', emoji: '😡', urgent: true }
}

const BUBBLE_PHASES = new Set<Car['phase']>([
  'queue',
  'toBay',
  'waiting',
  'charging',
  'leaving',
  'angry',
])

/** A speech bubble over each car in the station: battery and time left, or the driver's mood. */
function CarBubbles() {
  const ids = useGame(
    useShallow((s) => s.state.cars.filter((c) => BUBBLE_PHASES.has(c.phase)).map((c) => c.id)),
  )
  return (
    <>
      {ids.map((id) => (
        <CarBubble key={id} id={id} />
      ))}
    </>
  )
}

function CarBubble({ id }: { id: number }) {
  const group = useRef<THREE.Group>(null)
  const bubble = useGame(useShallow((s) => carBubble(s.state, id)))
  useFrame(() => {
    const { state, prev } = useGame.getState()
    const car = state.cars.find((c) => c.id === id)
    if (!car || !group.current) return
    const p = carPose(
      car,
      prev.cars.find((c) => c.id === id),
      tickAlpha(),
    )
    group.current.position.set(p.x, 2.3, p.z)
  })
  if (bubble.kind === 'none') return null
  return (
    <group ref={group}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        {bubble.kind === 'charge' ? (
          <div className={`car-bubble bubble-charge${bubble.stalled ? ' is-stalled' : ''}`}>
            <span className="bubble-battery" aria-hidden>
              <span style={{ height: `${bubble.percent}%` }} />
            </span>
            <span className="bubble-text">
              <strong>{bubble.percent}%</strong>
              <small>{bubble.stalled ? 'No power' : formatDuration(bubble.seconds)}</small>
            </span>
          </div>
        ) : (
          <div
            key={bubble.emoji}
            className={`car-bubble bubble-mood${bubble.urgent ? ' is-urgent' : ''}${bubble.emoji === '😍' ? ' is-happy' : ''}`}
          >
            {bubble.emoji}
          </div>
        )}
      </Html>
    </group>
  )
}
