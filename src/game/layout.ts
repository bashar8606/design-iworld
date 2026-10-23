// Where everything on a map stands, as ground footprints at its largest upgraded size, and the
// rules a map's layout must follow. Used by the layout test, the top-down layout view, and the
// scene for shared positions (carport posts, café queue, charge cables).
import footprintsJson from '../content/footprints.json'
import type { BayDef, Content, MapContent, PadDef, Vec2 } from './types.ts'
import { bayStop, itemPos } from './world.ts'

const F = footprintsJson as {
  charger: Half
  cash: Half
  panelRow: Half
  battery: Half
  cafe: Box
  carWash: Half
  staff: Half
  windTurbine: Half
  pad: number
  landPad: number
  raisedPost: number
  raisedPostInset: number
  vehicleHalfWidth: number
  bayDepth: number
  laneHalfWidth: number
  staffHut: Half
  palm: Half
  lamp: Half
  planter: Half
  pine: Half
  lodge: Half
  fence: number
  queueGap: number
  cafeQueue: Box
}
interface Half {
  hx: number
  hz: number
}
interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type FootprintKind =
  'item' | 'pad' | 'vehicle' | 'post' | 'walk' | 'lane' | 'decor' | 'fence' | 'route' | 'plaza'

export interface Footprint extends Box {
  name: string
  kind: FootprintKind
  /** The pad that builds it, so a pad never clashes with its own item. */
  padId?: string
}

const around = (x: number, z: number, h: Half): Box => ({
  minX: x - h.hx,
  maxX: x + h.hx,
  minZ: z - h.hz,
  maxZ: z + h.hz,
})
const shifted = (x: number, z: number, b: Box): Box => ({
  minX: x + b.minX,
  maxX: x + b.maxX,
  minZ: z + b.minZ,
  maxZ: z + b.maxZ,
})

export function overlaps(a: Box, b: Box, slack = 0.05): boolean {
  return (
    a.minX < b.maxX - slack &&
    b.minX < a.maxX - slack &&
    a.minZ < b.maxZ - slack &&
    b.minZ < a.maxZ - slack
  )
}

/** How deep a parking bay is painted, back from the stop line. */
export const BAY_DEPTH = F.bayDepth

/** Where a sedan-length car's nose stops in a bay: every vehicle parks with its nose here. */
export function stopLine(bay: BayDef): Vec2 {
  const dx = bay.post.x - bay.car.x
  const dz = bay.post.z - bay.car.z
  const d = Math.hypot(dx, dz) || 1
  return { x: bay.car.x + (dx / d) * 2.3, z: bay.car.z + (dz / d) * 2.3 }
}

/** Lines between neighbouring bays (and beyond the end ones), where carport posts can stand. */
function bayGaps(map: MapContent): number[] {
  const zs = map.bays.map((b) => b.car.z).sort((a, b) => a - b)
  if (zs.length === 0) return []
  const gaps = zs.slice(1).map((z, i) => (z + zs[i]!) / 2)
  const half = zs.length > 1 ? (zs[1]! - zs[0]!) / 2 : 1.5
  return [zs[0]! - half, ...gaps, zs.at(-1)! + half]
}

/**
 * Posts holding up a raised panel row (carport or roof deck). Rows over the parking bays stand
 * their posts on the lines between bays so cars park between them; other rows use their corners.
 */
export function raisedRowPosts(map: MapContent, pad: PadDef): Vec2[] {
  const at = itemPos(pad)
  const xs = [at.x - F.panelRow.hx + F.raisedPostInset, at.x + F.panelRow.hx - F.raisedPostInset]
  const overBays = map.bays.some(
    (b) => Math.abs(b.car.z - at.z) < 2 && Math.abs(b.car.x - at.x) < F.panelRow.hx,
  )
  const zs = overBays
    ? bayGaps(map).filter((z) => Math.abs(z - at.z) <= 1.6)
    : [at.z - F.panelRow.hz - 0.1, at.z + F.panelRow.hz + 0.1]
  return xs.flatMap((x) => zs.map((z) => ({ x, z })))
}

/** Where café customers stand, in front of the serving window. */
export function cafeSpots(cafe: Vec2): Vec2[] {
  const q = F.cafeQueue
  const z = cafe.z + (q.minZ + q.maxZ) / 2
  return [-1.6, -0.55, 0.55, 1.6].map((dx, i) => ({ x: cafe.x + dx, z: z + (i % 2 ? 0.3 : -0.2) }))
}

/** Where a parked vehicle's charge port is, for the charging cable. */
export function chargePort(bay: BayDef, content: Content, type: string) {
  const def = content.cars[type] ?? content.cars.hatchback!
  const stop = bayStop(bay, def.length)
  const dx = bay.post.x - bay.car.x
  const dz = bay.post.z - bay.car.z
  const d = Math.hypot(dx, dz) || 1
  const f = { x: dx / d, z: dz / d }
  // Left of the direction of travel.
  const left = { x: f.z, z: -f.x }
  const [forward, side, y] = def.port
  return {
    x: stop.x + f.x * forward + left.x * side,
    y,
    z: stop.z + f.z * forward + left.z * side,
  }
}

function longestVehicle(content: Content): number {
  return Math.max(...Object.keys(content.map.carTypes).map((t) => content.cars[t]?.length ?? 0))
}

/** Every footprint on a map with everything built and upgraded. */
export function footprints(content: Content): Footprint[] {
  const { map } = content
  const out: Footprint[] = []
  const add = (name: string, kind: FootprintKind, box: Box, padId?: string) =>
    out.push({ name, kind, ...box, padId })
  for (const pad of map.pads) {
    const at = itemPos(pad)
    const size = pad.kind === 'land' ? F.landPad : F.pad
    // Free pads are built before the game starts, so their pad is never on the ground.
    if (pad.price > 0)
      add(`pad ${pad.id}`, 'pad', around(pad.pos.x, pad.pos.z, { hx: size, hz: size }), pad.id)
    switch (pad.kind) {
      case 'charger': {
        const bay = map.bays.find((b) => b.id === pad.bay)
        if (!bay) break
        add(`charger ${pad.id}`, 'item', around(bay.post.x, bay.post.z, F.charger), pad.id)
        const cash = { x: bay.post.x + map.cashStackOffset, z: bay.post.z }
        add(`cash ${pad.id}`, 'walk', around(cash.x, cash.z, F.cash), pad.id)
        break
      }
      case 'panelRow':
        if ((pad.buildY ?? 0) > 0) {
          for (const [i, p] of raisedRowPosts(map, pad).entries())
            add(
              `post ${pad.id}.${i}`,
              'post',
              around(p.x, p.z, { hx: F.raisedPost, hz: F.raisedPost }),
              pad.id,
            )
        } else add(`panels ${pad.id}`, 'item', around(at.x, at.z, F.panelRow), pad.id)
        break
      case 'battery':
        add(`battery ${pad.id}`, 'item', around(at.x, at.z, F.battery), pad.id)
        break
      case 'cafe':
        add('café', 'item', shifted(at.x, at.z, F.cafe), pad.id)
        add('café queue', 'walk', shifted(at.x, at.z, F.cafeQueue), pad.id)
        break
      case 'carWash':
        add('car wash', 'item', around(at.x, at.z, F.carWash), pad.id)
        break
      case 'windTurbine':
        add(`turbine ${pad.id}`, 'item', around(at.x, at.z, F.windTurbine), pad.id)
        break
      case 'land':
        break
      default:
        add(`${pad.kind} ${pad.id}`, 'item', around(at.x, at.z, F.staff), pad.id)
    }
  }
  const site = map.site
  if (site?.plaza) add('plaza', 'plaza', site.plaza)
  if (site?.yard) {
    const y = site.yard
    const t = F.fence
    add('yard fence north', 'fence', {
      minX: y.minX,
      maxX: y.maxX,
      minZ: y.minZ - t,
      maxZ: y.minZ + t,
    })
    add('yard fence south', 'fence', {
      minX: y.minX,
      maxX: y.maxX,
      minZ: y.maxZ - t,
      maxZ: y.maxZ + t,
    })
    add('yard fence east', 'fence', {
      minX: y.maxX - t,
      maxX: y.maxX + t,
      minZ: y.minZ,
      maxZ: y.maxZ,
    })
    add('yard fence west', 'fence', {
      minX: y.minX - t,
      maxX: y.minX + t,
      minZ: y.minZ,
      maxZ: y.gateMinZ,
    })
    add('yard fence west ', 'fence', {
      minX: y.minX - t,
      maxX: y.minX + t,
      minZ: y.gateMaxZ,
      maxZ: y.maxZ,
    })
  }
  for (const [i, b] of (site?.buildings ?? []).entries())
    add(`${b.kind} ${i}`, 'item', around(b.pos.x, b.pos.z, F[b.kind]))
  for (const [i, d] of (site?.decor ?? []).entries())
    add(`${d.kind} ${i}`, 'decor', around(d.pos.x, d.pos.z, F[d.kind]))
  // The way out through the car wash, as wide as a car.
  const route = map.washRoute ?? []
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!
    const b = route[i]!
    const w = F.vehicleHalfWidth
    add(`wash route leg ${i}`, 'route', {
      minX: Math.min(a.x, b.x) - w,
      maxX: Math.max(a.x, b.x) + w,
      minZ: Math.min(a.z, b.z) - w,
      maxZ: Math.max(a.z, b.z) + w,
    })
  }
  const longest = longestVehicle(content)
  for (const bay of map.bays) {
    const stop = bayStop(bay, longest)
    add(
      `vehicle in ${bay.id}`,
      'vehicle',
      around(stop.x, stop.z, { hx: longest / 2, hz: F.vehicleHalfWidth }),
    )
  }
  add('entry lane', 'lane', {
    minX: map.lane.x - F.laneHalfWidth,
    maxX: map.lane.x + F.laneHalfWidth,
    minZ: map.lane.entryZ,
    maxZ: map.lane.exitZ,
  })
  return out
}

/** Everything wrong with a map's layout, as readable lines; empty when it is sound. */
export function layoutProblems(content: Content): string[] {
  const { map } = content
  const all = footprints(content)
  const problems = new Set<string>()
  const solid = all.filter(
    (f) =>
      f.kind === 'item' ||
      f.kind === 'walk' ||
      f.kind === 'post' ||
      f.kind === 'decor' ||
      f.kind === 'fence',
  )
  const vehicles = all.filter((f) => f.kind === 'vehicle')
  const pads = all.filter((f) => f.kind === 'pad')
  const lane = all.find((f) => f.kind === 'lane')!

  // Built things never overlap each other, parked vehicles or the lane.
  for (let i = 0; i < solid.length; i++) {
    const a = solid[i]!
    for (let j = i + 1; j < solid.length; j++) {
      const b = solid[j]!
      if (a.padId === b.padId) continue
      if (a.kind === 'post' && b.kind === 'post') continue
      if (a.kind === 'fence' && b.kind === 'fence') continue
      if (overlaps(a, b)) problems.add(`${a.name} overlaps ${b.name}`)
    }
    for (const v of vehicles)
      if (overlaps(a, v)) problems.add(`${a.name} is in the way of the ${v.name}`)
    if (overlaps(a, lane)) problems.add(`${a.name} stands in the entry lane`)
  }
  for (const v of vehicles)
    if (overlaps(v, lane)) problems.add(`the ${v.name} sticks into the entry lane`)

  // Build pads sit on free ground (their own item may cover them once built).
  for (const p of pads) {
    for (const s of [...solid, ...vehicles, lane])
      if (s.padId !== p.padId && overlaps(p, s)) problems.add(`${p.name} is under ${s.name}`)
    for (const q of pads)
      if (q !== p && q.name > p.name && overlaps(p, q)) problems.add(`${p.name} touches ${q.name}`)
  }

  // Industry stays out of the customers' plaza.
  const plaza = all.find((f) => f.kind === 'plaza')
  if (plaza)
    for (const f of all)
      if (/^(battery|turbine|yard)/.test(f.name) && overlaps(f, plaza))
        problems.add(`${f.name} stands on the customers' plaza`)

  // Cars leaving through the car wash have a clear way.
  for (const leg of all.filter((f) => f.kind === 'route'))
    for (const f of [...solid, ...vehicles, ...pads])
      if (f.name !== 'car wash' && f.padId !== 'carWash' && overlaps(leg, f))
        problems.add(`${f.name} blocks the ${leg.name}`)

  // Everything inside the map (scenery may stand outside it).
  const b = map.bounds
  for (const f of [...solid.filter((s) => s.kind !== 'decor'), ...pads, ...vehicles])
    if (f.minX < b.minX || f.maxX > b.maxX || f.minZ < b.minZ || f.maxZ > b.maxZ)
      problems.add(`${f.name} is outside the map`)

  // Zone fences only cross gaps; pads stand in the zone they belong to.
  // Fences stand only where one zone meets another.
  const zones = map.zones ?? []
  const fenceEdges = new Set(
    zones.flatMap((z) =>
      zones.filter((o) => o.bounds.minZ === z.bounds.maxZ).map(() => z.bounds.maxZ),
    ),
  )
  for (const zone of zones) {
    for (const edge of [zone.bounds.minZ, zone.bounds.maxZ]) {
      if (!fenceEdges.has(edge)) continue
      for (const f of [...solid, ...pads])
        if (f.maxX > zone.bounds.minX && f.minZ < edge - 0.05 && f.maxZ > edge + 0.05)
          problems.add(`the fence at z=${edge} runs through ${f.name}`)
    }
  }
  for (const pad of map.pads) {
    const zoneId = pad.zone ?? map.zones?.[0]?.id
    const zone = map.zones?.find((z) => z.id === zoneId)
    if (!zone) continue
    const { x, z } = pad.pos
    const zb = zone.bounds
    if (x < zb.minX || x > zb.maxX || z < zb.minZ || z > zb.maxZ)
      problems.add(`pad ${pad.id} is not inside its zone ${zone.id}`)
  }

  // Queued vehicles fit nose to tail.
  const qs = map.queueSlots.map((q) => q.z).sort((x, y) => x - y)
  const gap = Math.min(...qs.slice(1).map((z, i) => z - qs[i]!))
  const need = longestVehicle(content) + F.queueGap
  if (qs.length > 1 && gap < need - 1e-6)
    problems.add(`queue spots are ${gap.toFixed(1)} m apart; vehicles need ${need.toFixed(1)} m`)
  return [...problems]
}
