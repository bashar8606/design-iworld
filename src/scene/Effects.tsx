import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Vec2 } from '../game/types.ts'
import { getContent } from '../game/content.ts'
import { onGameEvent } from '../store/events.ts'
import { useGame } from '../store/gameStore.ts'
import { formatCash } from '../ui/format.ts'
import { builtAt } from './buildPop.ts'

interface Coin {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
}

interface Floater {
  sprite: THREE.Sprite
  life: number
}

const GRAVITY = -14

export function Effects() {
  const coins = useRef<Coin[]>([])
  const floaters = useRef<Floater[]>([])
  const coinMesh = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const coinGeometry = useMemo(() => new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), [])
  const coinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#F7C948',
        metalness: 0.6,
        roughness: 0.3,
        emissive: '#7A5A10',
        emissiveIntensity: 0.3,
      }),
    [],
  )

  useEffect(() => {
    const burst = (p: Vec2, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        coins.current.push({
          pos: new THREE.Vector3(p.x, 0.5, p.z),
          vel: new THREE.Vector3(
            Math.cos(a) * (1.5 + Math.random()),
            5 + Math.random() * 3,
            Math.sin(a) * (1.5 + Math.random()),
          ),
          life: 1.1,
        })
      }
    }
    const float = (p: Vec2, text: string, color: string, height = 2.2) => {
      const sprite = makeTextSprite(text, color)
      sprite.position.set(p.x, height, p.z)
      group.current?.add(sprite)
      floaters.current.push({ sprite, life: 1.2 })
    }
    return onGameEvent((e) => {
      if (e.type === 'padBuilt') {
        builtAt.set(e.padId, performance.now())
        burst(e.pos, 16)
      } else if (e.type === 'upgradeDone') {
        builtAt.set(e.id, performance.now())
      } else if (e.type === 'carPaid' && (e.cafe > 0 || e.carWash > 0)) {
        // Show where the money was spent: over the kiosk and the car wash.
        const pads = getContent(useGame.getState().state.mapId).map.pads
        const cafe = pads.find((p) => p.kind === 'cafe')
        const wash = pads.find((p) => p.kind === 'carWash')
        if (e.cafe > 0 && cafe)
          float({ x: cafe.pos.x, z: cafe.pos.z + 0.6 }, `☕ +${formatCash(e.cafe)}`, '#7A5230', 3.4)
        if (e.carWash > 0 && wash) float(wash.pos, `🫧 +${formatCash(e.carWash)}`, '#1E6FA8', 4.4)
      } else if (e.type === 'cashCollected') {
        float(e.pos, `+${formatCash(e.amount)}`, '#2E7D32')
      } else if (e.type === 'carLost') {
        const car = useGame.getState().state.cars.find((c) => c.id === e.carId)
        if (car) float(car.pos, '😠', '#E5484D')
      }
    })
  }, [])

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const s = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useFrame(({ clock }, dt) => {
    const mesh = coinMesh.current
    if (mesh) {
      coins.current = coins.current.filter((c) => (c.life -= dt) > 0)
      coins.current.forEach((c, i) => {
        c.vel.y += GRAVITY * dt
        c.pos.addScaledVector(c.vel, dt)
        if (c.pos.y < 0.05) {
          c.pos.y = 0.05
          c.vel.multiplyScalar(0.4)
          c.vel.y = Math.abs(c.vel.y)
        }
        q.setFromEuler(new THREE.Euler(clock.elapsedTime * 8 + i, 0, 0.4))
        mesh.setMatrixAt(i, m4.compose(c.pos, q, s))
      })
      mesh.count = coins.current.length
      mesh.instanceMatrix.needsUpdate = true
    }
    floaters.current = floaters.current.filter((f) => {
      f.life -= dt
      f.sprite.position.y += dt * 1.4
      ;(f.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life * 2)
      if (f.life <= 0) {
        group.current?.remove(f.sprite)
        ;(f.sprite.material as THREE.SpriteMaterial).map?.dispose()
        f.sprite.material.dispose()
        return false
      }
      return true
    })
  })

  return (
    <group ref={group}>
      <instancedMesh
        ref={coinMesh}
        args={[coinGeometry, coinMaterial, 120]}
        frustumCulled={false}
      />
    </group>
  )
}

function makeTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.font = 'bold 64px system-ui, -apple-system, "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.strokeText(text, 128, 50)
  ctx.fillStyle = color
  ctx.fillText(text, 128, 50)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      toneMapped: false,
    }),
  )
  sprite.scale.set(2.4, 0.9, 1)
  sprite.renderOrder = 20
  return sprite
}
