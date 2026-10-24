import { describe, expect, it } from 'vitest'
import { getQuarryContent } from '../quarry/content.ts'
import { quarryLayoutProblems } from '../quarry/layout.ts'
import { routeLength } from '../quarry/route.ts'
import { heightAt, nearestOnRoute, routeHeight, routePoint } from '../quarry/terrain.ts'
import type { QuarryContent } from '../quarry/types.ts'

const quarry = getQuarryContent('quarry1').quarry

function edited(change: (q: QuarryContent) => void): QuarryContent {
  const q = structuredClone(quarry)
  change(q)
  return q
}

describe('quarry layout', () => {
  it('Pine Ridge has no layout problems', () => {
    expect(quarryLayoutProblems(quarry)).toEqual([])
  })

  it('catches a pad on the walk from a face to the hopper', () => {
    const q = edited((q) => {
      const f = q.faces[0]!.pos
      const h = q.crusher.hopper
      q.pads.find((p) => p.id === 'operator')!.pos = { x: (f.x + h.x) / 2, z: (f.z + h.z) / 2 }
    })
    expect(quarryLayoutProblems(q).some((p) => p.includes('pad operator is on the walk'))).toBe(
      true,
    )
  })

  it('catches a pad on the buyers road and a pad inside bench 2', () => {
    const q = edited((q) => {
      q.pads.find((p) => p.id === 'foreman')!.pos = { x: 8, z: q.buyers.road.z }
      q.pads.find((p) => p.id === 'mechanic')!.pos = { ...q.bench2.pos }
    })
    const problems = quarryLayoutProblems(q)
    expect(problems).toContain('pad foreman overlaps buyers road')
    expect(problems).toContain('pad mechanic is inside bench 2')
  })

  it('catches a haul road that is too steep or never reaches bench 2', () => {
    const steep = edited((q) => {
      q.bench2.depth = 12
    })
    expect(quarryLayoutProblems(steep).some((p) => p.startsWith('haul road is too steep'))).toBe(
      true,
    )
    const lost = edited((q) => {
      q.machines.trucks.route[0] = { x: 20, z: -10 }
    })
    expect(quarryLayoutProblems(lost)).toContain('haul road does not start on bench 2')
  })
})

describe('quarry terrain', () => {
  const { pit } = quarry.site
  it('is flat outside the pit, the old pit floor inside, and bench 2 below once dug', () => {
    expect(heightAt(quarry, 15, 10)).toBeCloseTo(0)
    const floor = { x: pit.x + pit.rx * 0.45, z: pit.z + pit.rz * 0.55 }
    expect(heightAt(quarry, floor.x, floor.z)).toBeCloseTo(-pit.depth)
    const b2 = quarry.bench2.pos
    expect(heightAt(quarry, b2.x, b2.z, 0)).toBeCloseTo(-pit.depth)
    expect(heightAt(quarry, b2.x, b2.z, 1)).toBeCloseTo(-quarry.bench2.depth)
  })

  it('has no cliffs: the walls slope, so the player can walk in and out', () => {
    const step = 0.25
    let worst = 0
    const road = quarry.layout.haulHalfWidth + 1.6
    for (let x = -22; x < 4; x += step)
      for (let z = -15; z < 6; z += step) {
        // The haul road is cut into the wall; its sides may be steep.
        if (nearestOnRoute(quarry.machines.trucks.route, x, z).dist < road) continue
        const h = heightAt(quarry, x, z)
        worst = Math.max(
          worst,
          Math.abs(heightAt(quarry, x + step, z) - h),
          Math.abs(heightAt(quarry, x, z + step) - h),
        )
      }
    expect(worst / step).toBeLessThan(2.5)
  })

  it('carries the haul road from the bench 2 floor up to the ground by the hopper', () => {
    const length = routeLength(quarry.machines.trucks.route)
    expect(routeHeight(quarry, 0)).toBeCloseTo(-quarry.bench2.depth)
    expect(routeHeight(quarry, length)).toBeCloseTo(0)
    for (let d = 0; d <= length; d += 0.5) {
      const p = routePoint(quarry, d)
      // The ground under the road matches the road (the ramp is carved into the terrain).
      expect(Math.abs(heightAt(quarry, p.pos.x, p.pos.z) - p.y)).toBeLessThan(0.05)
    }
  })
})
