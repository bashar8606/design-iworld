import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import type { Vec2 } from '../game/types.ts'
import { useGame } from '../store/gameStore.ts'
import { useTutorial } from '../store/tutorial.ts'
import { upgradeOptions } from '../ui/upgrades.ts'
import { FACE_CAMERA } from './billboard.ts'

const MAX_ARROWS = 32
const HEIGHT = { charger: 2.5, panelRow: 2.2, battery: 2.9, windTurbine: 3.2 } as Record<
  string,
  number
>

/** A round green badge with a white up arrow. */
function arrowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 8, 0, 120)
  grad.addColorStop(0, '#7BE35A')
  grad.addColorStop(1, '#22A447')
  ctx.beginPath()
  ctx.arc(64, 64, 54, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.lineWidth = 9
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(64, 26)
  ctx.lineTo(96, 62)
  ctx.lineTo(76, 62)
  ctx.lineTo(76, 98)
  ctx.lineTo(52, 98)
  ctx.lineTo(52, 62)
  ctx.lineTo(32, 62)
  ctx.closePath()
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Bobbing green arrows over every piece of equipment the player can afford to upgrade. */
export function UpgradeArrows() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.PlaneGeometry(0.75, 0.75), [])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: arrowTexture(),
        transparent: true,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  )
  const targets = useRef<{ pos: Vec2; y: number }[]>([])
  const nextCheck = useRef(0)
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const scale = useMemo(() => new THREE.Vector3(1, 1, 1), [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const now = clock.elapsedTime
    // The affordable set changes slowly; recompute it twice a second.
    if (now >= nextCheck.current) {
      nextCheck.current = now + 0.5
      const { state } = useGame.getState()
      const content = getContent(state.mapId)
      targets.current = useTutorial.getState().active
        ? []
        : upgradeOptions(state, content)
            .filter(
              (o) =>
                o.kind in HEIGHT &&
                o.to &&
                o.upgradingUntil === 0 &&
                o.price !== null &&
                state.cash >= o.price,
            )
            .slice(0, MAX_ARROWS)
            .map((o) => ({
              pos: o.pos,
              y:
                (content.map.pads.find((p) => p.id === o.id)?.buildY ?? 0) +
                (HEIGHT[o.kind] ?? 2.4),
            }))
    }
    targets.current.forEach((t, i) => {
      pos.set(t.pos.x, t.y + 0.15 * Math.sin(now * 4 + i), t.pos.z)
      mesh.setMatrixAt(i, m4.compose(pos, FACE_CAMERA, scale))
    })
    mesh.count = targets.current.length
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, MAX_ARROWS]}
      frustumCulled={false}
      renderOrder={15}
    />
  )
}
