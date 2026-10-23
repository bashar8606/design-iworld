import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import type { MapContent, ZoneDef } from '../game/types.ts'
import { isPadUnlocked, zoneOwned } from '../game/world.ts'
import { useGame } from '../store/gameStore.ts'
import { builtAt } from './buildPop.ts'
import { CAMERA_AZIMUTH_DEG } from './constants.ts'

const POST_SPACING = 1.1
const FENCE_DROP_SECONDS = 0.6
const LABEL_ROTATION = new THREE.Euler(-Math.PI / 2, (CAMERA_AZIMUTH_DEG * Math.PI) / 180, 0, 'YXZ')

/** Where two zones meet along z: the fence between them. */
interface FenceLine {
  key: string
  z: number
  minX: number
  maxX: number
  zones: [string, string]
}

function fenceLines(zones: ZoneDef[]): FenceLine[] {
  const out: FenceLine[] = []
  for (const a of zones) {
    for (const b of zones) {
      if (a.bounds.maxZ !== b.bounds.minZ) continue
      const minX = Math.max(a.bounds.minX, b.bounds.minX)
      const maxX = Math.min(a.bounds.maxX, b.bounds.maxX)
      if (maxX > minX)
        out.push({ key: `${a.id}-${b.id}`, z: a.bounds.maxZ, minX, maxX, zones: [a.id, b.id] })
    }
  }
  return out
}

/** Land not bought yet: a darker overlay with its name, fenced off from the land the player owns. */
export function Zones() {
  const mapId = useGame((s) => s.state.mapId)
  const map = getContent(mapId).map
  const zones = map.zones
  const locked = useGame(
    useShallow((s) => (zones ?? []).filter((z) => !zoneOwned(s.state, map, z.id)).map((z) => z.id)),
  )
  const lines = useMemo(() => fenceLines(zones ?? []), [zones])
  if (!zones) return null
  return (
    <group>
      {zones
        .filter((z) => locked.includes(z.id))
        .map((z) => (
          <LockedZone key={z.id} zone={z} map={map} />
        ))}
      {lines.map((line) => (
        <Fence key={line.key} line={line} map={map} />
      ))}
    </group>
  )
}

function stripeTexture(city: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = city ? '#2E3138' : '#A88A5C'
  ctx.fillRect(0, 0, 64, 64)
  ctx.strokeStyle = city ? '#3A3E46' : '#B99B6B'
  ctx.lineWidth = 14
  for (let i = -64; i < 128; i += 32) {
    ctx.beginPath()
    ctx.moveTo(i, 64)
    ctx.lineTo(i + 64, 0)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

function labelTexture(name: string, forSale: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.font = '72px "Lilita One", system-ui, sans-serif'
  ctx.lineWidth = 14
  ctx.strokeStyle = 'rgba(40,28,12,0.55)'
  ctx.strokeText(`🔒 ${name}`, 256, 62)
  ctx.fillStyle = '#FFF7E0'
  ctx.fillText(`🔒 ${name}`, 256, 62)
  ctx.font = '40px "Lilita One", system-ui, sans-serif'
  ctx.lineWidth = 10
  const sub = forSale ? 'For sale' : 'Coming soon'
  ctx.strokeText(sub, 256, 128)
  ctx.fillStyle = forSale ? '#FFC531' : '#F1E6CC'
  ctx.fillText(sub, 256, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function LockedZone({ zone, map }: { zone: ZoneDef; map: MapContent }) {
  const b = zone.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const land = map.pads.find((p) => p.opensZone === zone.id)
  const forSale = useGame((s) => !!land && isPadUnlocked(s.state, land, map))
  const stripes = useMemo(() => {
    const t = stripeTexture(map.theme === 'city')
    t.repeat.set(w / 2, d / 2)
    return t
  }, [map.theme, w, d])
  const label = useMemo(() => labelTexture(zone.name, forSale), [zone.name, forSale])
  useEffect(() => () => stripes.dispose(), [stripes])
  useEffect(() => () => label.dispose(), [label])
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(b.minX + b.maxX) / 2, 0.02, (b.minZ + b.maxZ) / 2]}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial
          map={stripes}
          transparent
          opacity={0.6}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        rotation={LABEL_ROTATION}
        position={[(b.minX + b.maxX) / 2, 0.04, (b.minZ + b.maxZ) / 2]}
        renderOrder={3}
      >
        <planeGeometry args={[6, 1.9]} />
        <meshBasicMaterial map={label} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

const WOOD = new THREE.MeshStandardMaterial({ color: '#C98B4F', roughness: 0.85 })
const WHITE_TIP = new THREE.MeshStandardMaterial({ color: '#F4EBDD', roughness: 0.8 })

/** Posts and two rails along one zone border; it sinks into the ground when the land is bought. */
function Fence({ line, map }: { line: FenceLine; map: MapContent }) {
  const group = useRef<THREE.Group>(null)
  const posts = useRef<THREE.InstancedMesh>(null)
  const count = Math.floor((line.maxX - line.minX) / POST_SPACING) + 1
  const postGeometry = useMemo(
    () => new THREE.BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0),
    [],
  )
  const length = line.maxX - line.minX
  useEffect(() => {
    const mesh = posts.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, m.makeTranslation(line.minX + (i * length) / (count - 1), 0, 0))
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, length, line.minX])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const { state } = useGame.getState()
    const a = zoneOwned(state, map, line.zones[0])
    const b = zoneOwned(state, map, line.zones[1])
    if (a !== b) {
      g.visible = true
      g.scale.y = 1
      return
    }
    // Both owned: the fence sinks away just after the purchase, then stays gone.
    const land = map.pads.find((p) => p.opensZone && line.zones.includes(p.opensZone))
    const t0 = land ? builtAt.get(land.id) : undefined
    const t = t0 === undefined ? Infinity : (performance.now() - t0) / 1000
    g.visible = a && t < FENCE_DROP_SECONDS
    g.scale.y = Math.max(0.01, 1 - t / FENCE_DROP_SECONDS)
  })

  return (
    <group ref={group} position={[0, 0, line.z]}>
      <instancedMesh ref={posts} args={[postGeometry, WOOD, count]} castShadow />
      {[0.32, 0.68].map((y) => (
        <mesh
          key={y}
          position={[(line.minX + line.maxX) / 2, y, 0]}
          material={y > 0.5 ? WHITE_TIP : WOOD}
        >
          <boxGeometry args={[length, 0.1, 0.06]} />
        </mesh>
      ))}
    </group>
  )
}
