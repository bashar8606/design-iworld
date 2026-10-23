import { OrthographicCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

/** Degrees above the horizon the camera looks down from. */
const ELEVATION_DEG = 35
/** Rotation around the lot, so the road runs diagonally across the screen. */
const AZIMUTH_DEG = 45
const DISTANCE = 40
/** World units that always fit across the shorter side of the screen. */
const VIEW_SIZE = 14

const elevation = (ELEVATION_DEG * Math.PI) / 180
const azimuth = (AZIMUTH_DEG * Math.PI) / 180
const position: [number, number, number] = [
  DISTANCE * Math.cos(elevation) * Math.sin(azimuth),
  DISTANCE * Math.sin(elevation),
  DISTANCE * Math.cos(elevation) * Math.cos(azimuth),
]

export function CameraRig() {
  const size = useThree((state) => state.size)
  const zoom = Math.min(size.width, size.height) / VIEW_SIZE

  return (
    <OrthographicCamera
      makeDefault
      position={position}
      zoom={zoom}
      near={0.1}
      far={200}
      onUpdate={(camera) => camera.lookAt(0, 0, 0)}
    />
  )
}
