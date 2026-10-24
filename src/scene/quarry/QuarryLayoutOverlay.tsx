import { useMemo } from 'react'
import * as THREE from 'three'
import { getQuarryContent } from '../../game/quarry/content.ts'
import {
  type QuarryFootprintKind,
  quarryFootprints,
  quarryLayoutProblems,
} from '../../game/quarry/layout.ts'
import { useGame } from '../../store/gameStore.ts'
import { useUi } from '../../store/uiStore.ts'

const QUARRY_LAYOUT_COLORS: Record<QuarryFootprintKind, string> = {
  pad: '#19B5A5',
  building: '#1E6FD9',
  pile: '#8A5CF6',
  face: '#3E9B5F',
  road: '#C2410C',
  walk: '#F29E4C',
}
const PROBLEM = '#E5484D'

/** Debug: every quarry footprint as an outline over the site; anything in a problem in red. */
export function QuarryLayoutOverlay() {
  const on = useUi((s) => s.layoutView)
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const geometry = useMemo(() => {
    if (!on) return null
    const { quarry } = getQuarryContent(quarryId)
    const problems = quarryLayoutProblems(quarry)
    const positions: number[] = []
    const colors: number[] = []
    const c = new THREE.Color()
    const y = 0.2
    const line = (ax: number, az: number, bx: number, bz: number) => {
      positions.push(ax, y, az, bx, y, bz)
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    for (const f of quarryFootprints(quarry)) {
      c.set(problems.some((p) => p.includes(f.name)) ? PROBLEM : QUARRY_LAYOUT_COLORS[f.kind])
      if (f.rect) {
        const r = f.rect
        line(r.minX, r.minZ, r.maxX, r.minZ)
        line(r.maxX, r.minZ, r.maxX, r.maxZ)
        line(r.maxX, r.maxZ, r.minX, r.maxZ)
        line(r.minX, r.maxZ, r.minX, r.minZ)
      } else if (f.circle) {
        const { c: o, r } = f.circle
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2
          const b = ((i + 1) / 24) * Math.PI * 2
          line(
            o.x + Math.cos(a) * r,
            o.z + Math.sin(a) * r,
            o.x + Math.cos(b) * r,
            o.z + Math.sin(b) * r,
          )
        }
      } else if (f.corridor) {
        const { points, half } = f.corridor
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1]!
          const b = points[i]!
          const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
          const nx = ((b.z - a.z) / len) * half
          const nz = (-(b.x - a.x) / len) * half
          line(a.x, a.z, b.x, b.z)
          if (half > 0.1) {
            line(a.x + nx, a.z + nz, b.x + nx, b.z + nz)
            line(a.x - nx, a.z - nz, b.x - nx, b.z - nz)
          }
        }
      }
    }
    // The pit and bench 2 rims, in yellow.
    c.set('#F7C948')
    for (const e of [
      { ...quarry.site.pit, pos: { x: quarry.site.pit.x, z: quarry.site.pit.z } },
      quarry.bench2,
    ])
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2
        const b = ((i + 1) / 40) * Math.PI * 2
        line(
          e.pos.x + Math.cos(a) * e.rx,
          e.pos.z + Math.sin(a) * e.rz,
          e.pos.x + Math.cos(b) * e.rx,
          e.pos.z + Math.sin(b) * e.rz,
        )
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [on, quarryId])
  if (!geometry) return null
  return (
    <lineSegments geometry={geometry} renderOrder={30}>
      <lineBasicMaterial vertexColors depthTest={false} toneMapped={false} />
    </lineSegments>
  )
}
