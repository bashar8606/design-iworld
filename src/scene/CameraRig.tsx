import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { ownedZones } from '../game/world.ts'
import { onGameEvent } from '../store/events.ts'
import { tickAlpha, useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { sceneView } from '../store/view.ts'
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

const REVEAL_SECONDS = 3
/** How far the camera pulls back at the height of a land reveal. */
const REVEAL_ZOOM_OUT = 0.68
/** The view widens a little with every zone the player owns. */
const ZOOM_PER_ZONE = 0.05

/** 0 → 1 → 0 over the reveal, easing in and out. */
function revealCurve(t: number): number {
  const x = Math.min(1, Math.max(0, t / REVEAL_SECONDS))
  const rise = Math.min(1, x / 0.3)
  const fall = Math.min(1, (1 - x) / 0.3)
  const k = Math.min(rise, fall)
  return k * k * (3 - 2 * k)
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
  // Switching business jumps straight to the player instead of gliding across the world.
  const shown = useRef<string | null>(null)
  const zoom = Math.min(size.width, size.height) / viewSize
  // Buying land swings the camera over the new zone and pulls back to show it.
  const reveal = useRef<{ center: THREE.Vector3; start: number } | null>(null)
  useEffect(
    () =>
      onGameEvent((e) => {
        if (e.type !== 'padBuilt' || e.kind !== 'land') return
        const map = getContent(useGame.getState().state.mapId).map
        const zoneId = map.pads.find((p) => p.id === e.padId)?.opensZone
        const b = map.zones?.find((z) => z.id === zoneId)?.bounds
        if (!b) return
        reveal.current = {
          center: new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2),
          start: performance.now(),
        }
      }),
    [],
  )

  useFrame((_, dt) => {
    const cam = camera.current
    if (!cam) return
    const { state } = useGame.getState()
    const view = sceneView()
    const station = view.business === 'station'
    if (shown.current !== view.business) {
      shown.current = view.business
      first.current = true
    }
    const map = getContent(state.mapId).map
    if (useUi.getState().layoutView) {
      // Straight down over the whole map, north (−z) up.
      // The legend covers the bottom of the screen, so fit the map into the space above it.
      const b = view.bounds
      const w = b.maxX - b.minX + 4
      const d = b.maxZ - b.minZ + 4
      const free = size.height * 0.72
      cam.zoom = Math.min(size.width / w, free / d)
      cam.updateProjectionMatrix()
      const cx = (b.minX + b.maxX) / 2
      const cz = (b.minZ + b.maxZ) / 2 + (size.height - free) / 2 / cam.zoom
      cam.position.set(cx, 80, cz + 0.001)
      cam.lookAt(cx, 0, cz)
      first.current = true
      return
    }
    const zones = station && map.zones ? ownedZones(state, map).length : 1
    const r = reveal.current
    const rt = r ? (performance.now() - r.start) / 1000 : Infinity
    if (r && rt > REVEAL_SECONDS) reveal.current = null
    const k = r ? revealCurve(rt) : 0
    const goalZoom =
      zoom * (1 - ZOOM_PER_ZONE * Math.max(0, zones - 1)) * (1 - (1 - REVEAL_ZOOM_OUT) * k)
    if (Math.abs(cam.zoom - goalZoom) > 1e-3) {
      cam.zoom = first.current ? goalZoom : damp(cam.zoom, goalZoom, 4, dt)
      cam.updateProjectionMatrix()
    }
    const b = view.bounds
    const t = tickAlpha()
    const { player, prevPlayer } = view
    const goal =
      follow || !station
        ? new THREE.Vector3(
            Math.max(b.minX + 2, Math.min(b.maxX - 2, lerp(prevPlayer.pos.x, player.pos.x, t))),
            0,
            Math.max(b.minZ + 2, Math.min(b.maxZ - 2, lerp(prevPlayer.pos.z, player.pos.z, t))),
          )
        : overviewCenter(state)
    goal.y = station ? 0 : view.ground(goal.x, goal.z) * 0.6
    if (r) goal.lerp(r.center, k)
    if (first.current) {
      target.current.copy(goal)
      first.current = false
    } else {
      // Soft follow: eases in when the player stops.
      target.current.x = damp(target.current.x, goal.x, 5, dt)
      target.current.y = damp(target.current.y, goal.y, 5, dt)
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
