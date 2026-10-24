// Ground height across the quarry: the old pit, bench 2 below it and the haul road ramp. Pure,
// so the scene, the layout check and the tests agree.
import type { Vec2 } from '../types.ts'
import { pointAlong, routeLength } from './route.ts'
import type { QuarryContent } from './types.ts'

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

/** Normalised elliptical radius: 1 on the rim, 0 at the centre. */
function ellipseR(x: number, z: number, c: Vec2, rx: number, rz: number): number {
  return Math.hypot((x - c.x) / rx, (z - c.z) / rz)
}

/** 0 outside the rim, 1 once `wall` metres inside it, easing in between (the sloped wall). */
function inside(e: number, wall: number, rx: number, rz: number): number {
  return smoothstep((1 - e) / (wall / Math.min(rx, rz)))
}

/** Distance to the haul road's centre line and how far along the road that point is. */
export function nearestOnRoute(route: Vec2[], x: number, z: number) {
  let best = { dist: Infinity, d: 0 }
  let along = 0
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2))
    const dist = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
    if (dist < best.dist) best = { dist, d: along + t * Math.sqrt(len2) }
    along += Math.sqrt(len2)
  }
  return best
}

const flatCache = new WeakMap<QuarryContent, number>()

/** How far the haul road runs across the bench 2 floor before it starts to climb. */
export function rampStart(quarry: QuarryContent): number {
  const cached = flatCache.get(quarry)
  if (cached !== undefined) return cached
  const { route } = quarry.machines.trucks
  const b2 = quarry.bench2
  const floor = 1 - quarry.site.pit.wallWidth / Math.min(b2.rx, b2.rz)
  const length = routeLength(route)
  let d = 0
  while (d < length && ellipseR(...xz(pointAlong(route, d).pos), b2.pos, b2.rx, b2.rz) < floor)
    d += 0.1
  flatCache.set(quarry, d)
  return d
}

const xz = (p: Vec2): [number, number] => [p.x, p.z]

/** Height of the haul road `d` metres from the loading spot: flat on bench 2, then a steady climb. */
export function routeHeight(quarry: QuarryContent, d: number): number {
  const length = routeLength(quarry.machines.trucks.route)
  const start = rampStart(quarry)
  const k = Math.max(0, Math.min(1, (d - start) / Math.max(1e-6, length - start)))
  return -quarry.bench2.depth * (1 - k)
}

/**
 * Ground height at (x, z). `dug` runs from 0 (bench 2 not cut yet) to 1 (cut, with the ramp
 * down to it); the scene animates it when bench 2 is bought.
 */
export function heightAt(quarry: QuarryContent, x: number, z: number, dug = 1): number {
  const { pit } = quarry.site
  const b2 = quarry.bench2
  const wall = pit.wallWidth
  let h = -pit.depth * inside(ellipseR(x, z, pit, pit.rx, pit.rz), wall, pit.rx, pit.rz)
  if (dug <= 0) return h
  h -=
    (b2.depth - pit.depth) * dug * inside(ellipseR(x, z, b2.pos, b2.rx, b2.rz), wall, b2.rx, b2.rz)
  const { route } = quarry.machines.trucks
  const near = nearestOnRoute(route, x, z)
  const half = quarry.layout.haulHalfWidth
  const w = 1 - smoothstep((near.dist - half) / 1.4)
  if (w <= 0) return h
  return h + (routeHeight(quarry, near.d) - h) * w * dug
}

/** Where a truck `d` along the road stands, including its height on the ramp. */
export function routePoint(quarry: QuarryContent, d: number) {
  const { pos, heading } = pointAlong(quarry.machines.trucks.route, d)
  return { pos, heading, y: routeHeight(quarry, d) }
}
