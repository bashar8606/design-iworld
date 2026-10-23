import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { MapContent } from '../game/types.ts'
import { PALETTE } from './props/geometry.ts'

function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** The car park roof's parapet and the mall towers around it (map 2). */
export function CityScenery({ map }: { map: MapContent }) {
  const b = map.bounds
  const towers = useRef<THREE.InstancedMesh>(null)
  const towerList = useMemo(() => {
    const rand = seeded(5)
    const out: { x: number; z: number; w: number; h: number; d: number }[] = []
    for (let i = 0; i < 26; i++) {
      const angle = rand() * Math.PI * 2
      const r = 34 + rand() * 26
      const x = Math.cos(angle) * r + 2
      const z = Math.sin(angle) * r
      if (x < -6 && x > -22 && Math.abs(z) < 40) continue // keep the street clear
      out.push({ x, z, w: 5 + rand() * 6, h: 8 + rand() * 26, d: 5 + rand() * 6 })
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    towerList.forEach((t, i) => {
      m.makeScale(t.w, t.h, t.d).setPosition(t.x, t.h / 2, t.z)
      towers.current!.setMatrixAt(i, m)
      towers.current!.setColorAt(
        i,
        c.set(i % 3 === 0 ? '#9DB8CF' : i % 3 === 1 ? '#C9D6E0' : '#B5CADB'),
      )
    })
    towers.current!.instanceMatrix.needsUpdate = true
    if (towers.current!.instanceColor) towers.current!.instanceColor.needsUpdate = true
  }, [towerList])

  const walls: [number, number, number, number][] = [
    // x, z, width (x), depth (z)
    [(b.minX + b.maxX) / 2 + 0.8, b.minZ - 1.4, b.maxX - b.minX + 3.2, 0.4],
    [(b.minX + b.maxX) / 2 + 0.8, b.maxZ + 1.4, b.maxX - b.minX + 3.2, 0.4],
    [b.maxX + 2.2, (b.minZ + b.maxZ) / 2, 0.4, b.maxZ - b.minZ + 3.2],
  ]
  return (
    <group>
      {walls.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.45, z]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.9, d]} />
          <meshStandardMaterial color={PALETTE.concrete} />
        </mesh>
      ))}
      <instancedMesh
        ref={towers}
        args={[undefined, undefined, towerList.length]}
        castShadow
        receiveShadow
      >
        <boxGeometry />
        <meshStandardMaterial />
      </instancedMesh>
    </group>
  )
}
