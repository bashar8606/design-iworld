// The quarry's machines and people: the wheel loader on the top bench, the excavator and dump
// trucks on bench 2, the drill rig, and the operator, foreman and mechanic.
import { dist, moveToward } from '../vec.ts'
import { routeLength } from './route.ts'
import { padBuilt, truckCapacity } from './state.ts'
import type { QuarryContent, QuarryPadDef, QuarryState, Truck } from './types.ts'

/** Adds what a pad builds. Mutates `s` (a copy inside the tick). */
export function buildQuarryPad(s: QuarryState, pad: QuarryPadDef, quarry: QuarryContent) {
  s.pads[pad.id] = { paid: pad.price, built: true }
  switch (pad.kind) {
    case 'loader':
      s.loader = {
        pos: { ...quarry.machines.loader.home },
        heading: 0,
        phase: 'idle',
        faceId: null,
        load: 0,
        timer: 0,
      }
      break
    case 'truck':
      // New trucks pull out at the tipping end and head down for their first load.
      s.trucks.push({
        id: pad.id,
        d: routeLength(quarry.machines.trucks.route),
        phase: 'parked',
        load: 0,
      })
      break
    case 'drill':
      s.nextBlastAt = s.time + 3
      break
    default:
      // Land, the excavator and people are read from the pad itself.
      break
  }
}

/** Machines run while the player is there, and while away only with an operator. */
export function machinesRunning(s: QuarryState, offline: boolean): boolean {
  return !offline || padBuilt(s, 'operator')
}

const loaderSpot = (face: { x: number; z: number }, hopper: { x: number; z: number }) => {
  const d = dist(face, hopper) || 1
  return {
    x: face.x + ((hopper.x - face.x) / d) * 1.7,
    z: face.z + ((hopper.z - face.z) / d) * 1.7,
  }
}

export function runLoader(s: QuarryState, dt: number, quarry: QuarryContent) {
  const l = s.loader
  if (!l) return
  const def = quarry.machines.loader
  const { hopper, hopperTons } = quarry.crusher
  const tons = quarry.mining.tonsPerRock
  const dumpAt = { x: hopper.x - 1.6, z: hopper.z + 1.2 }
  const drive = (to: { x: number; z: number }) => {
    const [pos] = moveToward(l.pos, to, def.speed * dt)
    if (dist(pos, l.pos) > 1e-6) l.heading = Math.atan2(pos.x - l.pos.x, pos.z - l.pos.z)
    l.pos = pos
    return dist(pos, to) < 1e-6
  }
  switch (l.phase) {
    case 'idle': {
      const face = [...quarry.faces]
        .filter((f) => (s.faces[f.id] ?? 0) >= def.bucketRocks)
        .sort((a, b) => (s.faces[b.id] ?? 0) - (s.faces[a.id] ?? 0))[0]
      if (face) {
        l.faceId = face.id
        l.phase = 'toFace'
      } else drive(def.home)
      break
    }
    case 'toFace': {
      const face = quarry.faces.find((f) => f.id === l.faceId)
      if (!face) {
        l.phase = 'idle'
        break
      }
      if (drive(loaderSpot(face.pos, hopper))) {
        l.phase = 'scooping'
        l.timer = 0
      }
      break
    }
    case 'scooping': {
      l.timer += dt
      if (l.timer < def.scoopSeconds) break
      const rocks = Math.min(def.bucketRocks, Math.floor(s.faces[l.faceId ?? ''] ?? 0))
      if (rocks <= 0) {
        l.phase = 'idle'
        break
      }
      s.faces[l.faceId!]! -= rocks
      s.stats.rocksMined += rocks
      l.load = rocks
      l.phase = 'toHopper'
      break
    }
    case 'toHopper':
      if (drive(dumpAt)) {
        l.phase = 'dumping'
        l.timer = 0
      }
      break
    case 'dumping':
      if (s.hopper + l.load * tons > hopperTons + 1e-9) break
      l.timer += dt
      if (l.timer < def.dumpSeconds) break
      s.hopper += l.load * tons
      l.load = 0
      l.phase = 'idle'
      break
  }
}

/** The excavator digs bench 2 into a buffer at the loading spot; blasting makes it faster. */
export function runExcavator(s: QuarryState, dt: number, quarry: QuarryContent) {
  if (!padBuilt(s, 'excavator')) return
  const def = quarry.machines.excavator
  const room = def.bufferTons - s.digBuffer
  if (room <= 1e-9) return
  const fast = Math.min(s.broken, def.tonsPerSecond * dt, room)
  s.broken -= fast
  // Whatever time is left over digs unblasted rock, slowly.
  const leftover = 1 - fast / (def.tonsPerSecond * dt)
  const slow = Math.min(room - fast, def.tonsPerSecond * def.slowFactor * dt * leftover)
  s.digBuffer += fast + Math.max(0, slow)
}

export function runDrill(s: QuarryState, quarry: QuarryContent) {
  if (!padBuilt(s, 'drill') || s.time < s.nextBlastAt) return
  const def = quarry.machines.drill
  s.broken = Math.min(quarry.machines.excavator.maxBrokenTons, s.broken + def.blastTons)
  // The blast also shakes loose fresh rock on the top bench.
  for (const f of quarry.faces) s.faces[f.id] = f.rocks
  s.nextBlastAt = s.time + def.everySeconds
  s.events.push({ type: 'blast', pos: { ...def.pos } })
}

/**
 * Trucks shuttle along the haul road in two lanes: loaded towards the hopper, empty back to the
 * excavator. One loads and one tips at a time; the rest queue `gap` apart in their lane.
 */
export function runTrucks(s: QuarryState, dt: number, quarry: QuarryContent) {
  if (s.trucks.length === 0) return
  const def = quarry.machines.trucks
  const length = routeLength(def.route)
  const cap = truckCapacity(s, quarry)
  const boost = padBuilt(s, 'mechanic') ? 1 + quarry.machines.mechanicSpeedBonus : 1
  const toTip = (t: Truck) => t.phase === 'hauling' || t.phase === 'tipping'
  const onRoad = s.trucks.filter((t) => t.phase !== 'parked')
  // Room to start down the road from the tipping end.
  const endClear = (self: Truck) =>
    !onRoad.some((o) => o !== self && !toTip(o) && o.d > length - def.gap + 1e-6)
  // Front of each lane first, so each truck sees where the one ahead ended up.
  for (const t of s.trucks) {
    if (t.phase !== 'parked') continue
    if (endClear(t) && !onRoad.some((o) => o.phase === 'tipping')) {
      t.phase = 'returning'
      t.d = length
      onRoad.push(t)
    }
  }
  const order = onRoad.sort((a, b) =>
    toTip(a) === toTip(b) ? (toTip(a) ? b.d - a.d : a.d - b.d) : toTip(a) ? -1 : 1,
  )
  for (const t of order) {
    const lane = order.filter((o) => o !== t && toTip(o) === toTip(t))
    if (t.phase === 'hauling') {
      const ahead = lane.filter((o) => o.d > t.d - 1e-6).map((o) => o.d)
      const limit = Math.min(length, ...ahead.map((d) => d - def.gap))
      t.d = Math.max(t.d, Math.min(limit, t.d + def.speedLoaded * boost * dt))
      if (t.d >= length - 1e-6 && !lane.some((o) => o.phase === 'tipping')) t.phase = 'tipping'
    } else if (t.phase === 'returning') {
      const ahead = lane.filter((o) => o.d < t.d + 1e-6).map((o) => o.d)
      const limit = Math.max(0, ...ahead.map((d) => d + def.gap))
      t.d = Math.min(t.d, Math.max(limit, t.d - def.speedEmpty * boost * dt))
      if (t.d <= 1e-6 && !lane.some((o) => o.phase === 'loading')) t.phase = 'loading'
    } else if (t.phase === 'loading') {
      const take = Math.min(def.loadTonsPerSecond * dt, s.digBuffer, cap - t.load)
      t.load += take
      s.digBuffer -= take
      if (t.load >= cap - 1e-6) t.phase = 'hauling'
    } else {
      const room = quarry.crusher.hopperTons - s.hopper
      const tip = Math.min(def.tipTonsPerSecond * dt, t.load, Math.max(0, room))
      t.load -= tip
      s.hopper += tip
      if (t.load <= 1e-6) {
        t.load = 0
        if (endClear(t)) t.phase = 'returning'
      }
    }
  }
}

/** The foreman banks the counter's cash as soon as it lands. */
export function runForeman(s: QuarryState) {
  if (!padBuilt(s, 'foreman')) return
  for (const c of s.stacks) {
    s.cash += c.amount
    s.stats.totalEarned += c.amount
    s.events.push({ type: 'cashCollected', amount: c.amount, pos: c.pos, by: 'staff' })
  }
  s.stacks = []
}
