import * as THREE from 'three'

export interface Point3 {
  x: number
  y: number
  z: number
}

/** A sagging charging cable from a post socket to a car's port, as a thin tube. */
export function cableGeometry(from: Point3, to: Point3, sag = 0.5): THREE.TubeGeometry {
  const a = new THREE.Vector3(from.x, from.y, from.z)
  const b = new THREE.Vector3(to.x, to.y, to.z)
  const mid = a.clone().lerp(b, 0.5)
  mid.y = Math.min(a.y, b.y) - sag
  const curve = new THREE.CatmullRomCurve3([
    a,
    a.clone().lerp(mid, 0.6),
    mid,
    b.clone().lerp(mid, 0.6),
    b,
  ])
  return new THREE.TubeGeometry(curve, 16, 0.04, 5, false)
}
