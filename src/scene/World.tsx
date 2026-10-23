import { Canvas } from '@react-three/fiber'
import { CameraRig } from './CameraRig.tsx'
import { Charger } from './Charger.tsx'
import { Ground } from './Ground.tsx'

export function World() {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#bfe3f2']} />
      <CameraRig />

      <hemisphereLight args={['#fff6e0', '#d9c08e', 0.9]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />

      <Ground />
      <Charger position={[-3.5, 0, 0]} />
    </Canvas>
  )
}
