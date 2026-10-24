import { Rng } from '../rng.ts'
import type { TickInput, Vec2 } from '../types.ts'
import { dist, moveToward } from '../vec.ts'
import { dayClock, sunIntensity } from '../world.ts'
import { getQuarryContent } from './content.ts'
import {
  buildQuarryPad,
  machinesRunning,
  runDrill,
  runExcavator,
  runForeman,
  runLoader,
  runTrucks,
} from './machines.ts'
import {
  backpackCapacity,
  crusherRate,
  openQuarryPads,
  requirementsMet,
  upgradeOpen,
} from './state.ts'
import type {
  Buyer,
  QuarryAllContent,
  QuarryContent,
  QuarryState,
  QuarryUpgradeId,
} from './types.ts'

const NO_MOVE: TickInput = { move: { x: 0, z: 0 } }

export interface QuarryTickOptions {
  /** Offline catch-up: nobody is there to mine, and cash stacks are banked automatically. */
  offline?: boolean
}

function copy(state: QuarryState): QuarryState {
  return {
    ...state,
    player: { ...state.player, pos: { ...state.player.pos } },
    faces: { ...state.faces },
    belt: state.belt.map((b) => ({ ...b })),
    piles: { ...state.piles },
    levels: { ...state.levels },
    paid: { ...state.paid },
    pads: Object.fromEntries(Object.entries(state.pads).map(([k, v]) => [k, { ...v }])),
    loader: state.loader ? { ...state.loader, pos: { ...state.loader.pos } } : null,
    trucks: state.trucks.map((t) => ({ ...t })),
    buyers: state.buyers.map((b) => ({ ...b, pos: { ...b.pos } })),
    stacks: state.stacks.map((c) => ({ ...c, pos: { ...c.pos } })),
    stats: { ...state.stats },
    events: [],
  }
}

/**
 * Advances a quarry by `dt` seconds. Pure: returns a new state. The loop: mine rock at a face,
 * carry it to the hopper, the crusher turns it into gravel that rides the belt onto the pile,
 * buyers load from the pile and pay at the office counter, and the player collects the cash.
 */
export function tickQuarry(
  state: QuarryState,
  dt: number,
  input: TickInput = NO_MOVE,
  content: QuarryAllContent = getQuarryContent(state.quarryId),
  options: QuarryTickOptions = {},
): QuarryState {
  const { quarry } = content
  const s = copy(state)
  s.time += dt
  const clock = dayClock(s.time, quarry)
  s.day = clock.day
  s.dayTime = clock.dayTime
  s.sun = sunIntensity(clock.dayTime, quarry)

  if (!options.offline) {
    movePlayer(s, dt, input, quarry)
    mine(s, dt, quarry)
    dropIntoHopper(s, dt, quarry)
  }
  regrowFaces(s, dt, quarry)
  if (machinesRunning(s, !!options.offline)) {
    runDrill(s, quarry)
    runLoader(s, dt, quarry)
    runExcavator(s, dt, quarry)
    runTrucks(s, dt, quarry)
  }
  crush(s, dt, quarry)
  const rng = new Rng(s.seed)
  spawnBuyers(s, rng, quarry)
  s.seed = rng.seed
  serveBuyers(s, dt, quarry)
  if (options.offline) bankStacks(s, content.economy.offline.efficiency)
  else {
    runForeman(s)
    collectCash(s, quarry)
    payIntoPads(s, dt, quarry)
    payIntoUpgrades(s, dt, quarry)
  }
  return s
}

function movePlayer(s: QuarryState, dt: number, input: TickInput, quarry: QuarryContent) {
  const len = Math.hypot(input.move.x, input.move.z)
  const k = len > 1 ? 1 / len : 1
  const mx = input.move.x * k
  const mz = input.move.z * k
  const p = s.player
  p.moving = len > 0.05
  if (!p.moving) return
  const b = quarry.bounds
  p.pos = {
    x: Math.max(b.minX, Math.min(b.maxX, p.pos.x + mx * quarry.player.speed * dt)),
    z: Math.max(b.minZ, Math.min(b.maxZ, p.pos.z + mz * quarry.player.speed * dt)),
  }
  p.heading = Math.atan2(mx, mz)
}

/** The nearest face in reach that still has a whole rock, or null. */
export function faceInReach(s: QuarryState, quarry: QuarryContent): string | null {
  let best: string | null = null
  let bestD = quarry.mining.radius
  for (const f of quarry.faces) {
    const d = dist(s.player.pos, f.pos)
    if (d <= bestD && (s.faces[f.id] ?? 0) >= 1) {
      best = f.id
      bestD = d
    }
  }
  return best
}

function mine(s: QuarryState, dt: number, quarry: QuarryContent) {
  const cap = backpackCapacity(s, quarry)
  let face = s.player.carry < cap ? faceInReach(s, quarry) : null
  if (!face) {
    s.mineTimer = 0
    return
  }
  s.mineTimer += dt
  while (face && s.mineTimer >= quarry.mining.secondsPerRock) {
    s.mineTimer -= quarry.mining.secondsPerRock
    s.faces[face]! -= 1
    s.player.carry += 1
    s.stats.rocksMined += 1
    face = s.player.carry < cap ? faceInReach(s, quarry) : null
  }
  if (!face) s.mineTimer = 0
}

function dropIntoHopper(s: QuarryState, dt: number, quarry: QuarryContent) {
  const { mining, crusher } = quarry
  const room = () => s.hopper + mining.tonsPerRock <= crusher.hopperTons + 1e-9
  const near = dist(s.player.pos, crusher.hopper) <= mining.dropRadius
  if (!near || s.player.carry <= 0 || !room()) {
    s.dropTimer = 0
    return
  }
  s.dropTimer += dt
  while (s.player.carry > 0 && room() && s.dropTimer >= mining.dropSecondsPerRock) {
    s.dropTimer -= mining.dropSecondsPerRock
    s.player.carry -= 1
    s.hopper += mining.tonsPerRock
  }
}

function regrowFaces(s: QuarryState, dt: number, quarry: QuarryContent) {
  for (const f of quarry.faces) {
    const now = s.faces[f.id] ?? 0
    if (now < f.rocks) s.faces[f.id] = Math.min(f.rocks, now + dt / f.regenSecondsPerRock)
  }
}

/** Tons on a pile plus what is already riding the belt towards it. */
function pileCommitted(s: QuarryState, pileId: string): number {
  return (s.piles[pileId] ?? 0) + s.belt.reduce((sum, b) => sum + b.tons, 0)
}

function crush(s: QuarryState, dt: number, quarry: QuarryContent) {
  const pile = quarry.stockpiles[0]!
  // Crushed gravel lands on the pile when it reaches the end of the belt.
  while (s.belt.length > 0 && s.belt[0]!.at <= s.time + 1e-9) {
    s.piles[pile.id] = (s.piles[pile.id] ?? 0) + s.belt.shift()!.tons
  }
  const room = pile.capacityTons - pileCommitted(s, pile.id)
  const tons = Math.min(s.hopper, crusherRate(s, quarry) * dt, Math.max(0, room))
  if (tons <= 1e-9) return
  s.hopper -= tons
  s.stats.tonsCrushed += tons
  const at = s.time + quarry.crusher.beltSeconds
  const last = s.belt.at(-1)
  if (last && at - last.at < 0.5) last.tons += tons
  else s.belt.push({ tons, at })
}

function spawnBuyers(s: QuarryState, rng: Rng, quarry: QuarryContent) {
  if (s.time < s.nextBuyerAt) return
  const { buyers } = quarry
  const waiting = s.buyers.filter((b) => b.phase !== 'leaving').length
  if (waiting > buyers.road.maxWaiting) {
    s.nextBuyerAt = s.time + 2
    return
  }
  const types = buyers.types.filter((t) => requirementsMet(s, t.requires))
  const type = rng.pick(types.map((t) => ({ item: t, weight: t.weight })))!
  const id = s.nextBuyerId++
  s.buyers.push({
    id,
    type: type.id,
    pos: { x: buyers.road.spawnX, z: buyers.road.z },
    heading: -Math.PI / 2,
    phase: 'arriving',
    loaded: 0,
    waited: 0,
    exitStep: 0,
    angry: false,
  })
  s.nextBuyerAt = s.time + rng.range(...buyers.everySeconds)
  s.events.push({ type: 'carArrived', carId: id })
}

function serveBuyers(s: QuarryState, dt: number, quarry: QuarryContent) {
  const { buyers } = quarry
  const { road } = buyers
  const pile = quarry.stockpiles[0]!
  const price = quarry.products[pile.product]!.pricePerTon
  const step = buyers.speed * dt
  let slot = 0
  let aheadX = -Infinity
  for (const b of s.buyers) {
    const type = buyers.types.find((t) => t.id === b.type) ?? buyers.types[0]!
    if (b.phase === 'leaving') {
      leave(b, step, quarry)
      continue
    }
    // Queue in arrival order behind the bay, never closer than the spacing to the one ahead.
    const goal = Math.max(road.bayX + slot * road.queueSpacing, aheadX + road.queueSpacing)
    slot++
    if (b.phase === 'arriving') {
      b.pos.x = Math.max(goal, b.pos.x - step)
      if (slot === 1 && b.pos.x <= road.bayX + 1e-6) b.phase = 'loading'
    }
    aheadX = b.pos.x
    let loading = 0
    if (b.phase === 'loading') {
      loading = Math.min(
        buyers.loadTonsPerSecond * dt,
        s.piles[pile.id] ?? 0,
        type.loadTons - b.loaded,
      )
      b.loaded += loading
      s.piles[pile.id] = (s.piles[pile.id] ?? 0) - loading
    }
    if (loading <= 1e-9) b.waited += dt
    const full = b.loaded >= type.loadTons - 1e-6
    if (full || b.waited > type.patienceSeconds) {
      if (b.loaded > 1e-6) pay(s, b, Math.round(b.loaded * price * 100) / 100, quarry)
      if (!full) {
        b.angry = true
        s.stats.buyersLost += 1
        s.events.push({ type: 'carLost', carId: b.id })
      } else s.stats.buyersServed += 1
      s.stats.tonsSold += b.loaded
      b.phase = 'leaving'
      // A buyer still in the queue turns round; one at the bay drives on out.
      b.exitStep = b.pos.x > road.bayX + 0.5 ? -1 : 0
    }
  }
  s.buyers = s.buyers.filter((b) => b.phase !== 'leaving' || b.exitStep < road.exit.length)
}

function leave(b: Buyer, step: number, quarry: QuarryContent) {
  const { road } = quarry.buyers
  const target: Vec2 = b.exitStep === -1 ? { x: road.spawnX, z: road.z } : road.exit[b.exitStep]!
  const [pos] = moveToward(b.pos, target, step)
  if (dist(pos, b.pos) > 1e-6) b.heading = Math.atan2(pos.x - b.pos.x, pos.z - b.pos.z)
  b.pos = pos
  if (dist(pos, target) < 1e-6) b.exitStep = b.exitStep === -1 ? road.exit.length : b.exitStep + 1
}

function pay(s: QuarryState, b: Buyer, amount: number, quarry: QuarryContent) {
  const counter = quarry.office.counter
  const stack = s.stacks.find((c) => dist(c.pos, counter) < 1e-6)
  if (stack) stack.amount += amount
  else s.stacks.push({ id: s.nextStackId++, amount, pos: { ...counter } })
  s.events.push({ type: 'carPaid', carId: b.id, amount, pos: { ...b.pos }, cafe: 0, carWash: 0 })
}

function collectCash(s: QuarryState, quarry: QuarryContent) {
  s.stacks = s.stacks.filter((c) => {
    if (dist(c.pos, s.player.pos) > quarry.player.pickupRadius) return true
    s.cash += c.amount
    s.stats.totalEarned += c.amount
    s.events.push({ type: 'cashCollected', amount: c.amount, pos: c.pos, by: 'player' })
    return false
  })
}

/** Offline: stacks are banked at the offline efficiency, as at the station. */
function bankStacks(s: QuarryState, efficiency: number) {
  for (const c of s.stacks) {
    s.cash += c.amount * efficiency
    s.stats.totalEarned += c.amount * efficiency
  }
  s.stacks = []
}

function payIntoUpgrades(s: QuarryState, dt: number, quarry: QuarryContent) {
  for (const id of Object.keys(quarry.upgrades) as QuarryUpgradeId[]) {
    const def = quarry.upgrades[id]
    const price = def.prices[s.levels[id]]
    if (price === undefined || !upgradeOpen(s, quarry, id)) continue
    if (dist(s.player.pos, def.pad) > quarry.player.padRadius) continue
    const rate = Math.max(price / quarry.player.buildSeconds, quarry.player.minDrainPerSecond)
    const pay = Math.min(s.cash, price - s.paid[id], rate * dt)
    s.paid[id] += pay
    s.cash -= pay
    if (s.paid[id] >= price - 1e-6) {
      s.levels[id] += 1
      s.paid[id] = 0
      s.events.push({ type: 'upgradeDone', id: `quarry:${id}` })
    }
  }
}

/** Pays into the machine, person or land pad the player stands on. */
function payIntoPads(s: QuarryState, dt: number, quarry: QuarryContent) {
  for (const pad of openQuarryPads(s, quarry)) {
    if (dist(s.player.pos, pad.pos) > quarry.player.padRadius) continue
    const state = s.pads[pad.id] ?? { paid: 0, built: false }
    const rate = Math.max(pad.price / quarry.player.buildSeconds, quarry.player.minDrainPerSecond)
    const pay = Math.min(s.cash, pad.price - state.paid, rate * dt)
    s.pads[pad.id] = { ...state, paid: state.paid + pay }
    s.cash -= pay
    if (s.pads[pad.id]!.paid >= pad.price - 1e-6) {
      buildQuarryPad(s, pad, quarry)
      s.events.push({ type: 'upgradeDone', id: `quarry:${pad.id}` })
    }
    return
  }
}

/** Time spent away from the quarry: the crusher, belt and buyers keep going (capped). */
export function simulateQuarryOffline(
  state: QuarryState,
  seconds: number,
  content: QuarryAllContent = getQuarryContent(state.quarryId),
): { state: QuarryState; earned: number; seconds: number } {
  const { capSeconds, stepSeconds } = content.economy.offline
  const total = Math.max(0, Math.min(seconds, capSeconds))
  const before = state.cash
  let s = state
  let left = total
  while (left > 1e-9) {
    const dt = Math.min(stepSeconds, left)
    s = tickQuarry(s, dt, NO_MOVE, content, { offline: true })
    left -= dt
  }
  s = { ...s, events: [] }
  return { state: s, earned: Math.max(0, s.cash - before), seconds: total }
}
