import { Environment, Lightformer } from '@react-three/drei'
import textures from '../content/textures.json'

/** Soft reflections for the panels: the Poly Haven HDRI when downloaded, else light panels. */
export function Lighting() {
  if (textures.hdri) {
    return (
      <Environment
        files={`${import.meta.env.BASE_URL}${textures.hdri}`}
        environmentIntensity={0.4}
      />
    )
  }
  return (
    <Environment resolution={64} environmentIntensity={0.3}>
      <Lightformer intensity={2} color="#FFF3DE" position={[0, 6, -6]} scale={[12, 4, 1]} />
      <Lightformer intensity={1} color="#8FC8F0" position={[-6, 4, 4]} scale={[8, 6, 1]} />
      <Lightformer
        intensity={0.6}
        color="#E9D8B4"
        position={[0, -4, 0]}
        rotation-x={Math.PI / 2}
        scale={[20, 20, 1]}
      />
    </Environment>
  )
}
