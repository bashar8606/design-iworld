import { useMemo } from 'react'
import * as THREE from 'three'
import { getContent } from '../game/content.ts'
import { type FootprintKind, footprints, layoutProblems } from '../game/layout.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'

const COLORS: Record<FootprintKind, string> = {
  item: '#1E6FD9',
  pad: '#19B5A5',
  vehicle: '#8A5CF6',
  post: '#1E3557',
  walk: '#F29E4C',
  lane: '#7A7F87',
  decor: '#3E9B5F',
  fence: '#0E7F74',
  route: '#C2410C',
  plaza: '#B08D57',
}
const PROBLEM = '#E5484D'

/** Debug: every footprint as an outline on the ground; anything in a layout problem in red. */
export function LayoutOverlay() {
  const on = useUi((s) => s.layoutView)
  const mapId = useGame((s) => s.state.mapId)
  const geometry = useMemo(() => {
    if (!on) return null
    const content = getContent(mapId)
    const problems = layoutProblems(content)
    const positions: number[] = []
    const colors: number[] = []
    const c = new THREE.Color()
    const y = 0.08
    const zoneEdges = (content.map.zones ?? []).map((z) => z.bounds)
    for (const f of footprints(content)) {
      const bad = problems.some((p) => p.includes(f.name))
      c.set(bad ? PROBLEM : COLORS[f.kind])
      const corners = [
        [f.minX, f.minZ],
        [f.maxX, f.minZ],
        [f.maxX, f.maxZ],
        [f.minX, f.maxZ],
      ]
      for (let i = 0; i < 4; i++) {
        const [ax, az] = corners[i]!
        const [bx, bz] = corners[(i + 1) % 4]!
        positions.push(ax!, y, az!, bx!, y, bz!)
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
      }
    }
    // Zone borders as dashed-looking yellow lines.
    c.set('#F7C948')
    for (const b of zoneEdges)
      for (const z of [b.minZ, b.maxZ]) {
        positions.push(b.minX, y, z, b.maxX, y, z)
        colors.push(c.r, c.g, c.b, c.r, c.g, c.b)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return g
  }, [on, mapId])
  if (!geometry) return null
  return (
    <lineSegments geometry={geometry} renderOrder={30}>
      <lineBasicMaterial vertexColors depthTest={false} toneMapped={false} />
    </lineSegments>
  )
}
