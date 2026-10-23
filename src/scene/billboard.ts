import * as THREE from 'three'
import { CAMERA_AZIMUTH_DEG, CAMERA_ELEVATION_DEG } from './constants.ts'

const el = (CAMERA_ELEVATION_DEG * Math.PI) / 180
const az = (CAMERA_AZIMUTH_DEG * Math.PI) / 180

/** Rotation that turns a plane's +Z normal toward the (fixed-angle) game camera. */
export const FACE_CAMERA = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).normalize(),
)
