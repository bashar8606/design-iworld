// The quarry's layout check, like src/game/layout.ts for the stations: every pad, building,
// pile, road and conveyor has a footprint, and anything that collides or blocks is a problem.
import type { Vec2 } from '../types.ts'
import { dist } from '../vec.ts'
import { routeLength } from './route.ts'
import { heightAt, nearestOnRoute, rampStart } from './terrain.ts'
import type { QuarryContent, Rect } from './types.ts'

export type QuarryFootprintKind = 'pad' | 'building' | 'pile' | 'face' | 'road' | 'walk'

/** Footprints for the debug layout view: rectangles, circles and corridors (polylines). */
export interface QuarryFootprint {
  name: string
  kind: QuarryFootprintKind
  rect?: Rect
  circle?: { c: Vec2; r: number }
  corridor?: { points: Vec2[]; half: number }
}

function padRect(p: Vec2, size: number): Rect {
  const h = size / 2
  return { minX: p.x - h, maxX: p.x + h, minZ: p.z - h, maxZ: p.z + h }
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ
}

function rectCircle(a: Rect, c: Vec2, r: number): boolean {
  const x = Math.max(a.minX, Math.min(a.maxX, c.x))
  const z = Math.max(a.minZ, Math.min(a.maxZ, c.z))
  return Math.hypot(x - c.x, z - c.z) < r
}

/** Closest a rectangle comes to a polyline (0 if they touch). */
function rectToLine(a: Rect, points: Vec2[]): number {
  let best = Infinity
  const corners = [
    { x: a.minX, z: a.minZ },
    { x: a.maxX, z: a.minZ },
    { x: a.maxX, z: a.maxZ },
    { x: a.minX, z: a.maxZ },
    { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2 },
  ]
  for (const c of corners) best = Math.min(best, nearestOnRoute(points, c.x, c.z).dist)
  // A line passing through the rectangle.
  for (const p of points) if (p.x > a.minX && p.x < a.maxX && p.z > a.minZ && p.z < a.maxZ) return 0
  for (let i = 1; i < points.length; i++) {
    const a0 = points[i - 1]!
    const b0 = points[i]!
    for (let k = 1; k < 20; k++) {
      const t = k / 20
      const x = a0.x + (b0.x - a0.x) * t
      const z = a0.z + (b0.z - a0.z) * t
      if (x > a.minX && x < a.maxX && z > a.minZ && z < a.maxZ) return 0
    }
  }
  return best
}

function inEllipse(p: Vec2, c: Vec2, rx: number, rz: number): boolean {
  return Math.hypot((p.x - c.x) / rx, (p.z - c.z) / rz) < 1
}

export function quarryFootprints(q: QuarryContent): QuarryFootprint[] {
  const L = q.layout
  const out: QuarryFootprint[] = []
  for (const p of q.pads)
    out.push({ name: `pad ${p.id}`, kind: 'pad', rect: padRect(p.pos, L.padSize) })
  for (const [id, u] of Object.entries(q.upgrades))
    out.push({ name: `pad ${id} upgrade`, kind: 'pad', rect: padRect(u.pad, L.padSize) })
  for (const b of L.buildings) out.push({ name: `building ${b.id}`, kind: 'building', rect: b })
  for (const s of q.stockpiles)
    out.push({ name: `pile ${s.id}`, kind: 'pile', circle: { c: s.pos, r: L.pileRadius } })
  for (const f of q.faces)
    out.push({ name: `face ${f.id}`, kind: 'face', circle: { c: f.pos, r: L.faceRadius } })
  out.push({
    name: 'haul road',
    kind: 'road',
    corridor: { points: q.machines.trucks.route, half: L.haulHalfWidth },
  })
  const { road } = q.buyers
  out.push({
    name: 'buyers road',
    kind: 'road',
    corridor: {
      points: [{ x: road.spawnX, z: road.z }, ...road.exit],
      half: L.roadHalfWidth,
    },
  })
  out.push({
    name: 'conveyor',
    kind: 'road',
    corridor: {
      points: [{ x: q.crusher.pos.x, z: q.crusher.pos.z + 1.3 }, q.crusher.beltEnd],
      half: L.beltHalfWidth,
    },
  })
  for (const line of walkLines(q))
    out.push({ name: line.name, kind: 'walk', corridor: { points: line.points, half: 0.05 } })
  return out
}

/** Where the player walks over and over: each face to the hopper, the hopper to the counter. */
function walkLines(q: QuarryContent) {
  return [
    ...q.faces.map((f) => ({ name: `walk ${f.id}`, points: [f.pos, q.crusher.hopper] })),
    { name: 'walk counter', points: [q.crusher.hopper, q.office.counter] },
  ]
}

export function quarryLayoutProblems(q: QuarryContent): string[] {
  const L = q.layout
  const problems: string[] = []
  const prints = quarryFootprints(q)
  const pads = prints.filter((f) => f.kind === 'pad')
  const b = q.bounds

  // Everything the player has to reach is inside the walkable bounds.
  const reach: [string, Vec2][] = [
    ...q.pads.map((p): [string, Vec2] => [`pad ${p.id}`, p.pos]),
    ...Object.entries(q.upgrades).map(([id, u]): [string, Vec2] => [`pad ${id} upgrade`, u.pad]),
    ...q.faces.map((f): [string, Vec2] => [`face ${f.id}`, f.pos]),
    ['hopper', q.crusher.hopper],
    ['counter', q.office.counter],
  ]
  for (const [name, p] of reach)
    if (p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ)
      problems.push(`${name} is outside the walkable bounds`)

  // Pads never overlap each other or anything else.
  for (let i = 0; i < pads.length; i++) {
    const a = pads[i]!.rect!
    for (const other of prints) {
      if (other === pads[i] || other.kind === 'walk') continue
      if (other.kind === 'pad' && prints.indexOf(other) < prints.indexOf(pads[i]!)) continue
      const hit = other.rect
        ? rectsOverlap(a, other.rect)
        : other.circle
          ? rectCircle(a, other.circle.c, other.circle.r)
          : rectToLine(a, other.corridor!.points) < other.corridor!.half
      if (hit) problems.push(`${pads[i]!.name} overlaps ${other.name}`)
    }
    // ...or sit on the player's walking lines (walking over a pad spends money).
    for (const line of walkLines(q)) {
      const c = { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2 }
      if (nearestOnRoute(line.points, c.x, c.z).dist < q.player.padRadius + L.walkClearance)
        problems.push(`${pads[i]!.name} is on the ${line.name} line`)
    }
    // Pads stay out of bench 2.
    const c = { x: (a.minX + a.maxX) / 2, z: (a.minZ + a.maxZ) / 2 }
    if (inEllipse(c, q.bench2.pos, q.bench2.rx + L.padSize / 2, q.bench2.rz + L.padSize / 2))
      problems.push(`${pads[i]!.name} is inside bench 2`)
  }

  // Buildings and piles stay off the roads and the conveyor.
  for (const f of prints.filter((p) => p.kind === 'building' || p.kind === 'pile')) {
    for (const road of prints.filter((p) => p.kind === 'road')) {
      // The conveyor starts at the crusher and the trucks tip into its hopper.
      if (f.name === 'building crusher' && road.name !== 'buyers road') continue
      if (f.name === 'pile gravel' && road.name === 'conveyor') continue
      const corridor = road.corridor!
      const d = f.rect
        ? rectToLine(f.rect, corridor.points)
        : nearestOnRoute(corridor.points, f.circle!.c.x, f.circle!.c.z).dist - f.circle!.r
      if (d < corridor.half - 1e-6) problems.push(`${f.name} overlaps the ${road.name}`)
    }
  }

  // The haul road starts on bench 2, ends on the ground by the hopper and is not too steep.
  const route = q.machines.trucks.route
  const { pit } = q.site
  if (!inEllipse(route[0]!, q.bench2.pos, q.bench2.rx, q.bench2.rz))
    problems.push('haul road does not start on bench 2')
  if (inEllipse(route.at(-1)!, pit, pit.rx, pit.rz))
    problems.push('haul road does not climb out of the pit')
  const grade = q.bench2.depth / (routeLength(route) - rampStart(q))
  if (grade > L.maxGrade) problems.push(`haul road is too steep (${grade.toFixed(2)})`)
  if (dist(route.at(-1)!, q.crusher.hopper) > 2.6)
    problems.push('haul road ends too far from the hopper')

  // Machines that work bench 2 stand on it; the loader parks on the ground.
  const ex = q.machines.excavator
  for (const [name, p] of [
    ['excavator', ex.pos],
    ['blasted rock', ex.facePile],
    ['loading pile', ex.bufferPile],
    ['drill rig', q.machines.drill.pos],
  ] as [string, Vec2][])
    if (!inEllipse(p, q.bench2.pos, q.bench2.rx, q.bench2.rz))
      problems.push(`${name} is not on bench 2`)
  if (heightAt(q, q.machines.loader.home.x, q.machines.loader.home.z) < -0.05)
    problems.push('loader home is down in the pit')
  // Faces are on the rim, where the player mines standing on the ground.
  for (const f of q.faces)
    if (heightAt(q, f.pos.x, f.pos.z) < -0.05) problems.push(`face ${f.id} is down in the pit`)
  // Bench 2 fits inside the pit floor.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    const p = {
      x: q.bench2.pos.x + Math.cos(a) * q.bench2.rx,
      z: q.bench2.pos.z + Math.sin(a) * q.bench2.rz,
    }
    if (!inEllipse(p, pit, pit.rx - pit.wallWidth, pit.rz - pit.wallWidth)) {
      problems.push('bench 2 runs into the pit wall')
      break
    }
  }
  return problems
}
