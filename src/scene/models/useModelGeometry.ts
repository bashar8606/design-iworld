import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

export type ModelName =
  | 'hatchback'
  | 'sedan'
  | 'taxi'
  | 'scooter'
  | 'truck'
  | 'ski_bus'
  | 'cafe'
  | 'fast_charger'
  | 'worker'

export const modelUrl = (name: ModelName) => `${import.meta.env.BASE_URL}models/${name}.glb`

/**
 * The model's single mesh with its node transform baked in, plus its material, for instancing.
 * Blender's +Y forward exports as -Z, so models face -Z here.
 */
export function useModelGeometry(name: ModelName): {
  geometry: THREE.BufferGeometry
  material: THREE.Material
} {
  const gltf = useGLTF(modelUrl(name))
  return useMemo(() => {
    let found: THREE.Mesh | null = null
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh
    })
    if (!found) throw new Error(`${name}.glb has no mesh`)
    const mesh = found as THREE.Mesh
    const geometry = dequantize(mesh.geometry)
    geometry.applyMatrix4(mesh.matrixWorld)
    geometry.computeBoundingSphere()
    const material = (mesh.material as THREE.Material).clone()
    return { geometry, material }
  }, [gltf, name])
}

/**
 * meshopt-compressed models store positions and normals as normalized integers; baking a
 * transform into those would clamp them to ±1, so convert every attribute to plain floats first.
 */
export function dequantize(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone()
  const getters = ['getX', 'getY', 'getZ', 'getW'] as const
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const isPlainFloat =
      !(attr instanceof THREE.InterleavedBufferAttribute) && attr.array instanceof Float32Array
    if (isPlainFloat) continue
    const out = new Float32Array(attr.count * attr.itemSize)
    for (let i = 0; i < attr.count; i++) {
      // getX…getW read through interleaving and undo normalization.
      for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr[getters[k]!](i)
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize))
  }
  return geometry
}

for (const name of [
  'hatchback',
  'sedan',
  'taxi',
  'scooter',
  'truck',
  'ski_bus',
  'cafe',
  'fast_charger',
  'worker',
] as const) {
  useGLTF.preload(modelUrl(name))
}
