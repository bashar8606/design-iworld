import type { Vec2 } from '../types.ts'
import { dist } from '../vec.ts'

/** Total length of a polyline. */
export function routeLength(route: Vec2[]): number {
  let total = 0
  for (let i = 1; i < route.length; i++) total += dist(route[i - 1]!, route[i]!)
  return total
}

/** The point `d` along a polyline and the heading of that segment (0 faces +z). */
export function pointAlong(route: Vec2[], d: number): { pos: Vec2; heading: number } {
  let left = Math.max(0, d)
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const len = dist(a, b)
    const heading = Math.atan2(b.x - a.x, b.z - a.z)
    if (left <= len || i === route.length - 1) {
      const k = len > 0 ? Math.min(1, left / len) : 0
      return { pos: { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k }, heading }
    }
    left -= len
  }
  return { pos: { ...route[0]! }, heading: 0 }
}
