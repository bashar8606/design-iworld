import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { builtPadCount } from '../game/world.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import { lerp } from './interp.ts'

/** One contact shadow under the static layout, re-baked only when something is built. */
export function BakedContactShadow() {
  const built = useGame((s) => builtPadCount(s.state))
  const mapId = useGame((s) => s.state.mapId)
  const b = getContent(mapId).map.bounds
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const size = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) + 8
  return (
    <ContactShadows
      key={built}
      frames={1}
      position={[cx, 0.02, cz]}
      scale={size}
      resolution={512}
      far={4}
      blur={2.2}
      opacity={0.45}
      color="#3B2F1E"
    />
  )
}

/** Soft blob shadows under moving cars, the player and staff (cheap, no shadow maps). */
export function BlobShadows() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), [])
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32)
    g.addColorStop(0, 'rgba(40,30,20,0.55)')
    g.addColorStop(1, 'rgba(40,30,20,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    return new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
    })
  }, [])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const { state, prev } = useGame.getState()
    const t = tickAlpha()
    const prevCars = new Map(prev.cars.map((c) => [c.id, c]))
    let i = 0
    const put = (x: number, z: number, sx: number, sz: number, heading = 0) => {
      m4.makeRotationY(heading)
        .scale(new THREE.Vector3(sx, 1, sz))
        .setPosition(x, 0.03, z)
      mesh.setMatrixAt(i++, m4)
    }
    for (const car of state.cars) {
      const p = prevCars.get(car.id) ?? car
      put(lerp(p.pos.x, car.pos.x, t), lerp(p.pos.z, car.pos.z, t), 1.2, 2.4, car.heading)
    }
    put(
      lerp(prev.player.pos.x, state.player.pos.x, t),
      lerp(prev.player.pos.z, state.player.pos.z, t),
      0.5,
      0.5,
    )
    for (const m of state.staff) put(m.pos.x, m.pos.z, 0.5, 0.5)
    mesh.count = i
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, 64]}
      frustumCulled={false}
      renderOrder={1}
    />
  )
}
