import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MapContent } from '../game/types.ts'
import { propMaterial } from './materials.ts'
import { mountainGeometry, pineGeometry } from './props/geometry.ts'

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

interface Placement {
  x: number
  z: number
  s: number
  sy?: number
  r: number
}

function Instances({
  geometry,
  items,
  shadows = false,
}: {
  geometry: THREE.BufferGeometry
  items: Placement[]
  shadows?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    items.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r)
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.sy ?? p.s, p.s))
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, propMaterial, items.length]}
      castShadow={shadows}
      receiveShadow
    />
  )
}

/** Map 3: snowy pines around the lot, the lodge beside it and peaks on the horizon. */
export function AlpineScenery({ map }: { map: MapContent }) {
  const b = map.bounds
  const pine = useMemo(() => pineGeometry(), [])
  const mountain = useMemo(() => mountainGeometry(), [])
  const lodges = useMemo(
    () => (map.site?.decor ?? []).filter((d) => d.kind === 'lodge').map((d) => d.pos),
    [map],
  )
  const pines = useMemo(() => {
    const rand = seeded(9)
    const out: Placement[] = []
    for (let i = 0; out.length < 140 && i < 2000; i++) {
      const x = b.minX - 30 + rand() * (b.maxX - b.minX + 70)
      const z = b.minZ - 30 + rand() * (b.maxZ - b.minZ + 60)
      const inLot = x > b.minX - 1.5 && x < b.maxX + 1.5 && z > b.minZ - 1.5 && z < b.maxZ + 1.5
      const onRoad = x > map.road.laneX - 4.5 && x < b.minX + 1
      const byLodge = lodges.some((l) => Math.abs(x - l.x) < 7 && Math.abs(z - l.z) < 6)
      if (inLot || onRoad || byLodge) continue
      out.push({ x, z, s: 0.8 + rand() * 0.9, r: rand() * Math.PI * 2 })
    }
    return out
  }, [b, map.road.laneX, lodges])
  const peaks = useMemo(() => {
    const rand = seeded(21)
    const out: Placement[] = []
    for (let i = 0; i < 12; i++) {
      // A ring of peaks behind the lot, away from the camera side.
      const angle = Math.PI * (0.9 + rand() * 1.0)
      const r = 85 + rand() * 30
      const s = 22 + rand() * 18
      out.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        s,
        sy: s * (0.8 + rand() * 0.5),
        r: rand(),
      })
    }
    return out
  }, [])
  return (
    <group>
      <Instances geometry={pine} items={pines} shadows />
      <Instances geometry={mountain} items={peaks} />
    </group>
  )
}
