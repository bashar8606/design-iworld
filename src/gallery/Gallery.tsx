import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import assets from '../content/assets.json'
import { Lighting } from '../scene/Lighting.tsx'
import { propMaterial } from '../scene/materials.ts'
import { Worker } from '../scene/models/generated/index.ts'
import { type ModelName, useModelGeometry } from '../scene/models/useModelGeometry.ts'
import { cableGeometry } from '../scene/props/cableGeometry.ts'
import {
  batteryGeometry,
  canopySegmentGeometry,
  carWashGeometry,
  chargerPostGeometry,
  duneGeometry,
  panelCellTexture,
  panelFrameGeometry,
  panelFrameMatrices,
  panelModuleGeometry,
  panelRowMatrices,
  robotGeometry,
} from '../scene/props/geometry.ts'

interface Item {
  id: string
  label: string
  route: string
  limit: number
  size: number
  render: () => React.ReactNode
}

const models = assets.models as Record<string, { route: string; triangleLimit: number }>
const props = assets.props as Record<string, { route: string; triangleLimit: number }>

function ModelMesh({ name }: { name: ModelName }) {
  const { geometry, material } = useModelGeometry(name)
  return <mesh geometry={geometry} material={material} />
}

function Geo({ make }: { make: () => THREE.BufferGeometry }) {
  const geometry = useMemo(() => make(), [make])
  return <mesh geometry={geometry} material={propMaterial} />
}

function PanelRowPreview() {
  const modules = useMemo(() => panelModuleGeometry(), [])
  const frame = useMemo(() => panelFrameGeometry(), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ map: panelCellTexture(), roughness: 0.28, metalness: 0.35 }),
    [],
  )
  return (
    <>
      {panelRowMatrices(0, 0).map((m, i) => (
        <mesh
          key={`m${i}`}
          geometry={modules}
          material={material}
          matrix={m}
          matrixAutoUpdate={false}
        />
      ))}
      {panelFrameMatrices(0, 0).map((m, i) => (
        <mesh
          key={`f${i}`}
          geometry={frame}
          material={propMaterial}
          matrix={m}
          matrixAutoUpdate={false}
        />
      ))}
    </>
  )
}

const modelItem = (id: ModelName, label: string, size: number): Item => ({
  id,
  label,
  route: models[id]?.route ?? '?',
  limit: models[id]?.triangleLimit ?? 0,
  size,
  render: () => (id === 'worker' ? <Worker animation="Walk" /> : <ModelMesh name={id} />),
})

const propItem = (
  id: string,
  label: string,
  size: number,
  render: () => React.ReactNode,
): Item => ({
  id,
  label,
  route: props[id]?.route ?? 'code',
  limit: props[id]?.triangleLimit ?? 0,
  size,
  render,
})

const ITEMS: Item[] = [
  modelItem('hatchback', 'Hatchback', 5),
  modelItem('sedan', 'Sedan', 5.5),
  modelItem('taxi', 'Taxi', 5.5),
  modelItem('scooter', 'Scooter', 3),
  modelItem('cafe', 'Café kiosk', 9.5),
  modelItem('fast_charger', 'Fast charger', 3.5),
  modelItem('worker', 'Worker', 2.6),
  propItem('panelRow', 'Solar panel row', 9, () => <PanelRowPreview />),
  propItem('battery', 'Battery (small)', 3.5, () => <Geo make={() => batteryGeometry(0)} />),
  propItem('battery', 'Battery (container)', 7.5, () => <Geo make={() => batteryGeometry(1)} />),
  propItem('charger7', '7 kW post', 2.5, () => <Geo make={() => chargerPostGeometry(0)} />),
  propItem('charger22', '22 kW post', 2.5, () => <Geo make={() => chargerPostGeometry(1)} />),
  propItem('canopy', 'Canopy segment', 6, () => <Geo make={() => canopySegmentGeometry()} />),
  propItem('carWash', 'Car wash', 8, () => <Geo make={carWashGeometry} />),
  propItem('dune', 'Dune', 3, () => <Geo make={() => duneGeometry()} />),
  propItem('cable', 'Charging cable', 3, () => (
    <mesh
      geometry={cableGeometry({ x: -1, y: 1, z: 0 }, { x: 1, y: 0.8, z: 0 })}
      material={propMaterial}
    />
  )),
  propItem('robot', 'Cleaning robot', 2, () => <Geo make={robotGeometry} />),
]

interface Stats {
  triangles: number
  calls: number
}

function Turntable({ item, onStats }: { item: Item; onStats: (s: Stats) => void }) {
  const group = useRef<THREE.Group>(null)
  const gl = useThree((s) => s.gl)
  const last = useRef(0)
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.6
    last.current += dt
    if (last.current > 0.25) {
      last.current = 0
      onStats({ triangles: gl.info.render.triangles, calls: gl.info.render.calls })
    }
  })
  return (
    <group ref={group} key={item.id + item.label}>
      {item.render()}
    </group>
  )
}

function FitCamera({ size }: { size: number }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const viewport = useThree((s) => s.size)
  useFrame(() => {
    camera.zoom = Math.min(viewport.width, viewport.height) / size
    camera.position.set(8, 6, 8)
    camera.lookAt(0, size * 0.18, 0)
    camera.updateProjectionMatrix()
  })
  return null
}

/** /gallery: every model and code-built prop on a turntable with its triangle and draw-call count. */
export function Gallery() {
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<Stats>({ triangles: 0, calls: 0 })
  const item = ITEMS[index]!
  const over = item.limit > 0 && stats.triangles > item.limit
  return (
    <div className="gallery">
      <Canvas
        orthographic
        camera={{ position: [8, 6, 8], zoom: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#CFE7F3']} />
        <hemisphereLight args={['#FFFFFF', '#D9C08E', 0.8]} />
        <directionalLight position={[5, 8, 4]} intensity={2.2} />
        <FitCamera size={item.size} />
        <Suspense fallback={null}>
          <Lighting />
          <Turntable item={item} onStats={setStats} />
        </Suspense>
      </Canvas>
      <div className="gallery-panel">
        <h1>Asset gallery</h1>
        <div className={`gallery-stats${over ? ' gallery-over' : ''}`}>
          <strong>{item.label}</strong>
          <span>
            {stats.triangles.toLocaleString()} triangles
            {item.limit ? ` / ${item.limit.toLocaleString()} limit` : ''}
          </span>
          <span>{stats.calls} draw calls</span>
          <span>route: {item.route}</span>
        </div>
        <div className="gallery-list">
          {ITEMS.map((it, i) => (
            <button
              key={it.label}
              className={i === index ? 'active' : ''}
              onClick={() => setIndex(i)}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
