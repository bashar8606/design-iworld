import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { activeEvent } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'
import { FACE_CAMERA } from './billboard.ts'

const COUNT = 220
const AREA = 46

/** Sand streaks in a sandstorm, or snowfall on the snowy map; the haze itself is in DayNight. */
export function Weather() {
  const theme = useGame((s) => getContent(s.state.mapId).map.theme)
  return theme === 'snow' ? <Snowfall /> : <SandStreaks />
}

function SandStreaks() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.PlaneGeometry(1.6, 0.06), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#E8CFA0',
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: (i * 37.7) % AREA,
        y: 0.3 + ((i * 13.3) % 40) / 10,
        z: (i * 71.3) % AREA,
        speed: 14 + (i % 7) * 2,
      })),
    [],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const strength = useRef(0)
  useFrame(({ clock }, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const { state } = useGame.getState()
    const storm = activeEvent(state)?.kind === 'sandstorm'
    strength.current += ((storm ? 1 : 0) - strength.current) * Math.min(1, dt * 1.5)
    mesh.visible = strength.current > 0.02
    if (!mesh.visible) return
    material.opacity = 0.7 * strength.current
    const p = state.player.pos
    const t = clock.elapsedTime
    seeds.forEach((s, i) => {
      const x = ((s.x + t * s.speed) % AREA) - AREA / 2 + p.x
      const z = ((s.z + t * s.speed * 0.35) % AREA) - AREA / 2 + p.z
      m4.makeRotationY(-0.33).setPosition(x, s.y, z)
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geometry, material, COUNT]} frustumCulled={false} />
}

const FLAKES = 360
const FLAKE_AREA = 40
const FLAKE_HEIGHT = 12

/** Gentle snowfall around the player, thick and sideways in a blizzard. */
function Snowfall() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.CircleGeometry(0.07, 6), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const seeds = useMemo(
    () =>
      Array.from({ length: FLAKES }, (_, i) => ({
        x: (i * 37.7) % FLAKE_AREA,
        y: (i * 13.3) % FLAKE_HEIGHT,
        z: (i * 71.3) % FLAKE_AREA,
        fall: 1.2 + (i % 5) * 0.25,
        sway: (i % 7) * 0.9,
      })),
    [],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const strength = useRef(0)
  useFrame(({ clock }, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const { state } = useGame.getState()
    const blizzard = activeEvent(state)?.kind === 'sandstorm' ? 1 : 0
    strength.current += (blizzard - strength.current) * Math.min(1, dt * 1.5)
    const k = strength.current
    // A third of the flakes in calm weather, all of them in a blizzard.
    const count = Math.round(FLAKES * (0.35 + 0.65 * k))
    const p = state.player.pos
    const t = clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const s = seeds[i]!
      const drop = t * s.fall * (1 + 1.5 * k)
      const y = FLAKE_HEIGHT - ((s.y + drop) % FLAKE_HEIGHT)
      const drift = t * 9 * k
      const x = ((s.x + drift + Math.sin(t + s.sway) * 0.6) % FLAKE_AREA) - FLAKE_AREA / 2 + p.x
      const z = ((s.z + drift * 0.4) % FLAKE_AREA) - FLAKE_AREA / 2 + p.z
      pos.set(x, y, z)
      mesh.setMatrixAt(i, m4.compose(pos, FACE_CAMERA, scale))
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geometry, material, FLAKES]} frustumCulled={false} />
}
