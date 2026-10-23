import * as THREE from 'three'

/** One material for every vertex-coloured, code-built prop. */
export const propMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.75,
  metalness: 0.0,
  flatShading: true,
})

export const glowTeal = new THREE.MeshStandardMaterial({
  color: '#19B5A5',
  emissive: '#19B5A5',
  emissiveIntensity: 0.4,
  toneMapped: false,
})

export const glowLime = new THREE.MeshStandardMaterial({
  color: '#A6E22E',
  emissive: '#A6E22E',
  emissiveIntensity: 0.6,
  toneMapped: false,
})

export const cableMaterial = new THREE.MeshStandardMaterial({ color: '#2B2B2E', roughness: 0.6 })

/** Street-lamp heads: dim by day, warm and bright after dark (DayNight sets the intensity). */
export const glowLamp = new THREE.MeshStandardMaterial({
  color: '#FFF1C9',
  emissive: '#FFD27A',
  emissiveIntensity: 0.1,
  toneMapped: false,
})
