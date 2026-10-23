import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import {
  CAMERA_AZIMUTH_DEG,
  CAMERA_DISTANCE,
  CAMERA_ELEVATION_DEG,
  VIEW_SIZE,
} from './constants.ts'
import { damp, lerp } from './interp.ts'

const el = (CAMERA_ELEVATION_DEG * Math.PI) / 180
const az = (CAMERA_AZIMUTH_DEG * Math.PI) / 180
const offset = new THREE.Vector3(
  CAMERA_DISTANCE * Math.cos(el) * Math.sin(az),
  CAMERA_DISTANCE * Math.sin(el),
  CAMERA_DISTANCE * Math.cos(el) * Math.cos(az),
)

/** Centre of everything built, for the overview camera. */
function overviewCenter(state: ReturnType<typeof useGame.getState>['state']) {
  const pads = getContent(state.mapId).map.pads
  const xs = pads.map((p) => p.pos.x)
  const zs = pads.map((p) => p.pos.z)
  return new THREE.Vector3(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    0,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  )
}

/** Orthographic camera that follows the player smoothly and stays over the map. */
export function CameraRig({
  follow = true,
  viewSize = VIEW_SIZE,
}: {
  follow?: boolean
  viewSize?: number
}) {
  const camera = useRef<THREE.OrthographicCamera>(null)
  const size = useThree((s) => s.size)
  const target = useRef(new THREE.Vector3())
  const first = useRef(true)
  const zoom = Math.min(size.width, size.height) / viewSize

  useFrame((_, dt) => {
    const cam = camera.current
    if (!cam) return
    const { state, prev } = useGame.getState()
    const b = getContent(state.mapId).map.bounds
    const t = tickAlpha()
    const goal = follow
      ? new THREE.Vector3(
          Math.max(
            b.minX + 2,
            Math.min(b.maxX - 2, lerp(prev.player.pos.x, state.player.pos.x, t)),
          ),
          0,
          Math.max(
            b.minZ + 2,
            Math.min(b.maxZ - 2, lerp(prev.player.pos.z, state.player.pos.z, t)),
          ),
        )
      : overviewCenter(state)
    if (first.current) {
      target.current.copy(goal)
      first.current = false
    } else {
      // Soft follow: eases in when the player stops.
      target.current.x = damp(target.current.x, goal.x, 5, dt)
      target.current.z = damp(target.current.z, goal.z, 5, dt)
    }
    cam.position.copy(target.current).add(offset)
    cam.lookAt(target.current)
  })

  return (
    <OrthographicCamera
      ref={camera}
      makeDefault
      zoom={zoom}
      near={0.1}
      far={300}
      position={offset.toArray()}
    />
  )
}
