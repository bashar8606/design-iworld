import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/gameStore.ts'
import { STEPS, useTutorial } from '../store/tutorial.ts'

/** A bouncing arrow over whatever the tutorial wants the player to walk to. */
export function TutorialArrow() {
  const active = useTutorial((s) => s.active)
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const step = STEPS[useTutorial.getState().step]
    const target = step?.target(useGame.getState().state)
    g.visible = !!target
    if (!target) return
    g.position.set(target.x, 2.6 + 0.35 * Math.sin(clock.elapsedTime * 5), target.z)
    g.rotation.y = clock.elapsedTime * 1.5
  })
  if (!active) return null
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
