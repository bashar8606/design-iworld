import { useTexture } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import textures from '../content/textures.json'
import { getContent } from '../game/content.ts'
import { BAY_DEPTH, stopLine } from '../game/layout.ts'
import { useGame } from '../store/gameStore.ts'
import { AlpineScenery } from './Alpine.tsx'
import { CityScenery } from './City.tsx'
import { propMaterial } from './materials.ts'
import { PALETTE, duneGeometry, skylineGeometry } from './props/geometry.ts'

type TextureSet = { color: string; roughness?: string }
const manifest = textures.textures as Record<string, TextureSet | undefined>
const base = import.meta.env.BASE_URL

function seededRandom(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** Soft procedural noise for sand and asphalt until Poly Haven textures are downloaded. */
function noiseTexture(colorA: string, colorB: string, dots: number, repeat: number): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture()
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = colorA
  ctx.fillRect(0, 0, size, size)
  const rand = seededRandom(7)
  ctx.fillStyle = colorB
  for (let i = 0; i < dots; i++) {
    ctx.globalAlpha = 0.15 + rand() * 0.25
    const r = 1 + rand() * 3
    ctx.beginPath()
    ctx.ellipse(rand() * size, rand() * size, r * 2.2, r, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function SurfaceMaterial({
  slot,
  color,
  fallback,
}: {
  slot: string
  color: string
  fallback: THREE.Texture
}) {
  const set = manifest[slot]
  return set ? (
    <PolyHavenMaterial set={set} color={color} repeat={fallback.repeat.x} />
  ) : (
    <meshStandardMaterial color={color} map={fallback} roughness={0.95} />
  )
}

function PolyHavenMaterial({
  set,
  color,
  repeat,
}: {
  set: TextureSet
  color: string
  repeat: number
}) {
  const maps = useTexture({
    map: `${base}${set.color}`,
    ...(set.roughness ? { roughnessMap: `${base}${set.roughness}` } : {}),
  })
  useLayoutEffect(() => {
    for (const t of Object.values(maps)) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat, repeat)
    }
    maps.map.colorSpace = THREE.SRGBColorSpace
  }, [maps, repeat])
  return <meshStandardMaterial {...maps} color={color} />
}

export function Ground() {
  const mapId = useGame((s) => s.state.mapId)
  const map = getContent(mapId).map
  const city = map.theme === 'city'
  const snow = map.theme === 'snow'
  const skyline = useMemo(() => skylineGeometry(), [])
  const sand = useMemo(
    () =>
      city
        ? noiseTexture('#666B74', '#585C64', 900, 18)
        : snow
          ? noiseTexture('#F4F8FB', '#D6E2EC', 1200, 18)
          : noiseTexture('#E9D8B4', '#CDB688', 1400, 18),
    [city, snow],
  )
  const asphalt = useMemo(() => noiseTexture('#50545D', '#3E4149', 900, 10), [])
  const concrete = useMemo(
    () =>
      city
        ? noiseTexture('#AEB3BA', '#9DA2A9', 500, 6)
        : snow
          ? noiseTexture('#C7D0D8', '#E8EEF3', 700, 6)
          : noiseTexture('#D9D5C8', '#BDB8A9', 500, 6),
    [city, snow],
  )
  const b = map.bounds
  const roadX = map.road.laneX - 1.25
  const roadLength = map.road.despawnZ - map.road.spawnZ + 30

  const dashes = useMemo(() => {
    const out: number[] = []
    for (let z = map.road.spawnZ - 10; z < map.road.despawnZ + 10; z += 3) out.push(z)
    return out
  }, [map.road.spawnZ, map.road.despawnZ])

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        {city || snow ? (
          <meshStandardMaterial color="#FFFFFF" map={sand} roughness={0.95} />
        ) : (
          <SurfaceMaterial slot="sand" color="#FFFFFF" fallback={sand} />
        )}
      </mesh>
      {/* Two-lane highway along the west edge. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[roadX, 0.005, (map.road.spawnZ + map.road.despawnZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[5, roadLength]} />
        <SurfaceMaterial slot="asphalt" color="#FFFFFF" fallback={asphalt} />
      </mesh>
      <Dashes x={roadX} zs={dashes} />
      {[-2.45, 2.45].map((dx) => (
        <mesh
          key={dx}
          rotation-x={-Math.PI / 2}
          position={[roadX + dx, 0.012, (map.road.spawnZ + map.road.despawnZ) / 2]}
        >
          <planeGeometry args={[0.12, roadLength]} />
          <meshStandardMaterial color="#F4F1E8" />
        </mesh>
      ))}
      {/* Concrete forecourt: entry lane, queue, bays and the yard. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[(b.minX + b.maxX) / 2 - 0.4, 0.008, (b.minZ + b.maxZ) / 2]}
        receiveShadow
      >
        <planeGeometry args={[b.maxX - b.minX + 1.6, b.maxZ - b.minZ + 1.4]} />
        {snow ? (
          <meshStandardMaterial color="#FFFFFF" map={concrete} roughness={0.9} />
        ) : (
          <SurfaceMaterial slot="concrete" color="#FFFFFF" fallback={concrete} />
        )}
      </mesh>
      {/* Access lanes from the highway into the lot and back out. */}
      {[map.lane.entryZ, map.lane.exitZ].map((z) => (
        <mesh
          key={z}
          rotation-x={-Math.PI / 2}
          position={[(map.road.laneX + map.lane.x) / 2 - 0.4, 0.009, z - 0.5]}
          receiveShadow
        >
          <planeGeometry args={[Math.abs(map.lane.x - map.road.laneX) + 2, 3.6]} />
          <meshStandardMaterial color={PALETTE.asphalt} roughness={0.95} />
        </mesh>
      ))}
      <BayLines />
      {city ? <CityScenery map={map} /> : snow ? <AlpineScenery map={map} /> : <Dunes />}
      {!city && !snow && (
        <mesh
          geometry={skyline}
          material={propMaterial}
          position={[-62, 0, -70]}
          rotation-y={Math.PI / 4}
        />
      )}
    </group>
  )
}

function Dashes({ x, zs }: { x: number; zs: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    zs.forEach((z, i) => {
      m.makeRotationX(-Math.PI / 2).setPosition(x, 0.012, z)
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [x, zs])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, zs.length]}>
      <planeGeometry args={[0.14, 1.4]} />
      <meshStandardMaterial color="#F4F1E8" />
    </instancedMesh>
  )
}

function BayLines() {
  const mapId = useGame((s) => s.state.mapId)
  const map = getContent(mapId).map
  const ref = useRef<THREE.InstancedMesh>(null)
  // Two side lines per bay running back from the stop line, and a short bar on the stop line.
  const lines = useMemo(() => {
    const out: { x: number; z: number; stop?: boolean }[] = []
    for (const bay of map.bays) {
      const stop = stopLine(bay)
      const x = stop.x - BAY_DEPTH / 2
      out.push(
        { x, z: bay.car.z - 1.6 },
        { x, z: bay.car.z + 1.6 },
        { x: stop.x, z: stop.z, stop: true },
      )
    }
    return out
  }, [map])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const r = new THREE.Matrix4()
    lines.forEach((p, i) => {
      m.makeRotationX(-Math.PI / 2)
      if (p.stop) m.premultiply(r.makeRotationY(Math.PI / 2)).scale(new THREE.Vector3(0.5, 1, 1))
      m.setPosition(p.x, 0.014, p.z)
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [lines])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, lines.length]}>
      <planeGeometry args={[BAY_DEPTH, 0.1]} />
      <meshStandardMaterial color="#FFFFFF" />
    </instancedMesh>
  )
}

function Dunes() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => duneGeometry(), [])
  const dunes = useMemo(() => {
    const out: { x: number; z: number; sx: number; sy: number; sz: number }[] = []
    const rand = seededRandom(11)
    for (let i = 0; i < 46; i++) {
      const angle = rand() * Math.PI * 2
      const r = 30 + rand() * 30
      const x = Math.cos(angle) * r + 4
      const z = Math.sin(angle) * r
      if (x < -6 && x > -20) continue // keep the highway clear
      out.push({ x, z, sx: 4 + rand() * 6, sy: 0.8 + rand() * 1.8, sz: 3 + rand() * 4 })
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    dunes.forEach((d, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 0.7) % Math.PI)
      m.compose(new THREE.Vector3(d.x, -0.05, d.z), q, new THREE.Vector3(d.sx, d.sy, d.sz))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [dunes])
  return <instancedMesh ref={ref} args={[geometry, propMaterial, dunes.length]} receiveShadow />
}
