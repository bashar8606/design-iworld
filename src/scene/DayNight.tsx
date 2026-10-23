import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { useGame } from '../store/gameStore.ts'
import { glowLime, glowTeal } from './materials.ts'

// Colour keys across the day (dayTime 0..1). Night → dawn → day → dusk → night.
const KEYS: {
  t: number
  top: string
  horizon: string
  light: string
  ambient: string
  intensity: number
}[] = [
  {
    t: 0.0,
    top: '#0B1633',
    horizon: '#1B2A4E',
    light: '#8FA8FF',
    ambient: '#3A4A7A',
    intensity: 0.25,
  },
  {
    t: 0.17,
    top: '#16224A',
    horizon: '#3B3F6B',
    light: '#9FB0FF',
    ambient: '#45507F',
    intensity: 0.3,
  },
  {
    t: 0.23,
    top: '#6FA9D8',
    horizon: '#F6B98A',
    light: '#FFC68A',
    ambient: '#B9A99A',
    intensity: 1.4,
  },
  {
    t: 0.32,
    top: '#79BDEB',
    horizon: '#CFE9F7',
    light: '#FFF1D6',
    ambient: '#C9DCEA',
    intensity: 2.2,
  },
  {
    t: 0.72,
    top: '#79BDEB',
    horizon: '#CFE9F7',
    light: '#FFF1D6',
    ambient: '#C9DCEA',
    intensity: 2.2,
  },
  {
    t: 0.82,
    top: '#5C7FC2',
    horizon: '#F59A6B',
    light: '#FFAA6B',
    ambient: '#B89A8F',
    intensity: 1.6,
  },
  {
    t: 0.88,
    top: '#1D2756',
    horizon: '#6B4A7A',
    light: '#B08FFF',
    ambient: '#4F4A7A',
    intensity: 0.45,
  },
  {
    t: 1.0,
    top: '#0B1633',
    horizon: '#1B2A4E',
    light: '#8FA8FF',
    ambient: '#3A4A7A',
    intensity: 0.25,
  },
]

const tmpA = new THREE.Color()
const tmpB = new THREE.Color()

function sample(t: number, key: 'top' | 'horizon' | 'light' | 'ambient', out: THREE.Color) {
  const i = Math.max(0, KEYS.findIndex((k) => k.t > t) - 1)
  const a = KEYS[i]!
  const b = KEYS[i + 1] ?? a
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
  return out.copy(tmpA.set(a[key])).lerp(tmpB.set(b[key]), k)
}

function sampleIntensity(t: number) {
  const i = Math.max(0, KEYS.findIndex((k) => k.t > t) - 1)
  const a = KEYS[i]!
  const b = KEYS[i + 1] ?? a
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
  return a.intensity + (b.intensity - a.intensity) * k
}

const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 center;
  varying vec3 vWorld;
  void main() {
    float h = clamp((vWorld.y - center.y) / 60.0, 0.0, 1.0);
    gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0);
    #include <colorspace_fragment>
  }
`

/** Sky gradient, sun, ambient light and night glow, all driven by the simulation clock. */
export function DayNight({ shadows = true }: { shadows?: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const sky = useRef<THREE.Mesh>(null)
  const scene = useThree((s) => s.scene)
  const map = getContent(useGame.getState().state.mapId).map
  const uniforms = useMemo(
    () => ({
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      center: { value: new THREE.Vector3() },
    }),
    [],
  )
  const fogColor = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    const { state } = useGame.getState()
    const t = state.dayTime
    sample(t, 'top', uniforms.top.value)
    sample(t, 'horizon', uniforms.horizon.value)
    const target = state.player.pos

    if (sun.current) {
      // The sun sweeps from east (+x) to west (-x) across the day; the moon lights the night.
      const { sunrise, sunset } = map.day
      const day = Math.min(1, Math.max(0, (t - sunrise) / (sunset - sunrise)))
      const angle = state.sun > 0 ? Math.PI * day : Math.PI * 0.35
      const dir = new THREE.Vector3(Math.cos(angle) * 14, 12 + Math.sin(angle) * 10, 10)
      sun.current.position.set(target.x + dir.x, dir.y, target.z + dir.z)
      sun.current.target.position.set(target.x, 0, target.z)
      sun.current.target.updateMatrixWorld()
      sample(t, 'light', sun.current.color)
      sun.current.intensity = sampleIntensity(t)
    }
    if (hemi.current) {
      sample(t, 'ambient', hemi.current.color)
      hemi.current.intensity = 0.35 + 0.35 * Math.min(1, state.sun * 1.5)
    }
    if (sky.current) sky.current.position.set(target.x, 0, target.z)
    uniforms.center.value.set(target.x, 0, target.z)
    fogColor.copy(uniforms.horizon.value)
    if (scene.fog) scene.fog.color.copy(fogColor)
    if (scene.background instanceof THREE.Color) scene.background.copy(fogColor)

    // Chargers and battery strips glow brighter at night.
    const night = 1 - Math.min(1, state.sun * 2)
    glowTeal.emissiveIntensity = 0.35 + 1.6 * night
    glowLime.emissiveIntensity = 0.5 + 1.8 * night
  })

  return (
    <>
      <color attach="background" args={['#CFE9F7']} />
      <fog attach="fog" args={['#CFE9F7', 60, 140]} />
      <hemisphereLight ref={hemi} args={['#D8E4EC', '#D9C08E', 0.9]} />
      <directionalLight
        ref={sun}
        castShadow={shadows}
        intensity={2.4}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0008}
      />
      <mesh ref={sky} renderOrder={-1}>
        <sphereGeometry args={[120, 24, 12]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
        />
      </mesh>
    </>
  )
}
