import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/gameStore.ts'
import { billsFor } from './props/cash.ts'

const MAX_BILLS = 240
const m4 = new THREE.Matrix4()
const pos = new THREE.Vector3()
const quat = new THREE.Quaternion()
const one = new THREE.Vector3(1, 1, 1)
const up = new THREE.Vector3(0, 1, 0)

/** Cash stacks waiting to be collected, as instanced bills that bob gently. */
export function Pickups() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(0.5, 0.06, 0.28), [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7BC86C', roughness: 0.6 }),
    [],
  )
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const { pickups } = useGame.getState().state
    let i = 0
    for (const p of pickups) {
      const bob = 0.08 * Math.sin(clock.elapsedTime * 3 + p.id)
      for (let b = 0; b < billsFor(p.amount) && i < MAX_BILLS; b++) {
        pos.set(p.pos.x + ((b % 2) - 0.5) * 0.05, 0.12 + b * 0.065 + bob, p.pos.z)
        quat.setFromAxisAngle(up, b * 0.35 + clock.elapsedTime * 0.6)
        mesh.setMatrixAt(i++, m4.compose(pos, quat, one))
      }
    }
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, MAX_BILLS]}
      castShadow
      frustumCulled={false}
    />
  )
}
