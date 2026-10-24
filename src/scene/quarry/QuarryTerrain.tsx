import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { heightAt, nearestOnRoute } from '../../game/quarry/terrain.ts'
import type { QuarryContent } from '../../game/quarry/types.ts'
import { useGame } from '../../store/gameStore.ts'

const STEP = 0.5
const DIRT = new THREE.Color('#CDB68C')
const FLOOR = new THREE.Color('#BCA27A')
const BENCH = new THREE.Color('#A68D69')
const ROCK = new THREE.Color('#8C7D68')
const ROAD = new THREE.Color('#9A8B70')
/** Seconds bench 2 takes to dig itself out once bought. */
const DIG_SECONDS = 2.2

/** Colour by depth and steepness: dirt on top, paler floors, darker rock on the walls. */
function shade(q: QuarryContent, h: number, slope: number, onRoad: boolean, out: THREE.Color) {
  if (onRoad) return out.copy(ROAD)
  const pit = q.site.pit.depth
  if (h > -0.15) out.copy(DIRT)
  else if (h > -pit - 0.15) out.copy(FLOOR)
  else out.copy(BENCH)
  if (slope > 0.45) out.lerp(ROCK, Math.min(1, (slope - 0.45) * 1.6))
  return out
}

/**
 * The quarry's ground as one mesh: flat dirt across the site, the old pit with sloped walls and,
 * once bought, bench 2 and the ramp. Both shapes are baked into the geometry and a shader blends
 * between them (`uDig`), so buying bench 2 digs it out in front of the player.
 */
export function QuarryTerrain({ quarry }: { quarry: QuarryContent }) {
  const dug = useGame((s) => s.quarry?.pads.bench2?.built ?? false)
  const uniforms = useRef({ uDig: { value: dug ? 1 : 0 } })
  const target = useRef(dug ? 1 : 0)
  useEffect(() => {
    target.current = dug ? 1 : 0
  }, [dug])
  const geometry = useMemo(() => {
    const c = quarry.site.clearing
    const nx = Math.round((c.maxX - c.minX) / STEP)
    const nz = Math.round((c.maxZ - c.minZ) / STEP)
    const g = new THREE.PlaneGeometry(c.maxX - c.minX, c.maxZ - c.minZ, nx, nz)
    g.rotateX(-Math.PI / 2)
    g.translate((c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const n = pos.count
    const delta = new Float32Array(n)
    const before = new Float32Array(n * 3)
    const after = new Float32Array(n * 3)
    const col = new THREE.Color()
    const route = quarry.machines.trucks.route
    const half = quarry.layout.haulHalfWidth - 0.4
    const slopeAt = (x: number, z: number, dug: number) =>
      Math.hypot(
        heightAt(quarry, x + 0.25, z, dug) - heightAt(quarry, x - 0.25, z, dug),
        heightAt(quarry, x, z + 0.25, dug) - heightAt(quarry, x, z - 0.25, dug),
      ) / 0.5
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h0 = heightAt(quarry, x, z, 0)
      const h1 = heightAt(quarry, x, z, 1)
      pos.setY(i, h0)
      delta[i] = h1 - h0
      shade(quarry, h0, slopeAt(x, z, 0), false, col).toArray(before, i * 3)
      const onRoad = nearestOnRoute(route, x, z).dist < half
      shade(quarry, h1, slopeAt(x, z, 1), onRoad, col).toArray(after, i * 3)
    }
    g.setAttribute('aDelta', new THREE.BufferAttribute(delta, 1))
    g.setAttribute('color', new THREE.BufferAttribute(before, 3))
    g.setAttribute('aColorDug', new THREE.BufferAttribute(after, 3))
    g.computeVertexNormals()
    // Dug-out ground can drop below the base shape: keep it from being culled.
    g.computeBoundingSphere()
    g.boundingSphere!.radius += quarry.bench2.depth
    return g
  }, [quarry])
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uDig = uniforms.current.uDig
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aDelta;\nattribute vec3 aColorDug;\nuniform float uDig;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.y += aDelta * uDig;',
        )
        .replace(
          '#include <color_vertex>',
          '#include <color_vertex>\nvColor.rgb = mix(vColor.rgb, aColorDug, uDig);',
        )
    }
    return m
  }, [])
  useFrame((_, dt) => {
    const u = uniforms.current.uDig
    const goal = target.current
    if (u.value === goal) return
    const step = dt / DIG_SECONDS
    u.value = goal > u.value ? Math.min(goal, u.value + step) : Math.max(goal, u.value - step)
  })
  return <mesh geometry={geometry} material={material} receiveShadow />
}
