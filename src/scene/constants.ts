/** Degrees above the horizon the camera looks down from. */
export const CAMERA_ELEVATION_DEG = 35
/** Rotation of the camera around the lot. The joystick uses the same angle. */
export const CAMERA_AZIMUTH_DEG = 45
export const CAMERA_DISTANCE = 40
/** World units that fit across the shorter side of the screen. */
export const VIEW_SIZE = 13

const az = (CAMERA_AZIMUTH_DEG * Math.PI) / 180

/** Converts a screen-space joystick vector (x right, y up) into world x/z. */
export function screenToWorld(x: number, y: number): { x: number; z: number } {
  // Screen right = (cos az, -sin az); screen up = away from the camera = (-sin az, -cos az).
  return {
    x: x * Math.cos(az) - y * Math.sin(az),
    z: -x * Math.sin(az) - y * Math.cos(az),
  }
}
