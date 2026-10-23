import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { activeEvent } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'

const COUNT = 220
const AREA = 46

/** Blowing sand streaks during a sandstorm; the haze itself is in DayNight. */
export function Weather() {
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
