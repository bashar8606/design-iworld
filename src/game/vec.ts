import type { Vec2 } from './types.ts'

export const vec = (x: number, z: number): Vec2 => ({ x, z })

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Heading in radians where 0 faces +z and positive turns toward +x. */
export function headingTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

/** Moves toward `to` by up to `step`; returns the new position and leftover step. */
export function moveToward(from: Vec2, to: Vec2, step: number): [Vec2, number] {
  const d = dist(from, to)
  if (d <= step) return [{ x: to.x, z: to.z }, step - d]
  const k = step / d
  return [{ x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k }, 0]
}

/** Follows a waypoint path for `step` metres. Returns the remaining path. */
export function followPath(
  pos: Vec2,
  path: Vec2[],
  step: number,
): { pos: Vec2; path: Vec2[]; heading: number | null } {
  let current = pos
  let remaining = step
  let i = 0
  let heading: number | null = null
  while (i < path.length && remaining > 0) {
    const target = path[i]!
    if (dist(current, target) > 1e-6) heading = headingTo(current, target)
    ;[current, remaining] = moveToward(current, target, remaining)
    if (remaining > 0 || dist(current, target) < 1e-6) i++
  }
  return { pos: current, path: path.slice(i), heading }
}
