import { describe, expect, it } from 'vitest'
import { getQuarryContent } from '../quarry/content.ts'
import { backpackCapacity, createQuarryState } from '../quarry/state.ts'
import { simulateQuarryOffline, tickQuarry } from '../quarry/tick.ts'
import type { QuarryState } from '../quarry/types.ts'
import type { Vec2 } from '../types.ts'

const content = getQuarryContent('quarry1')
const { quarry } = content
const STILL = { move: { x: 0, z: 0 } }

function at(s: QuarryState, pos: Vec2): QuarryState {
  return { ...s, player: { ...s.player, pos: { ...pos } } }
}

function run(s: QuarryState, seconds: number): QuarryState {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) s = tickQuarry(s, 0.1, STILL, content)
  return s
}

const face = quarry.faces[0]!
const pile = quarry.stockpiles[0]!

describe('mining by hand', () => {
  it('fills the backpack at a face, then stops', () => {
    let s = at(createQuarryState(), face.pos)
    s = run(s, 1)
    expect(s.player.carry).toBe(Math.floor(1 / quarry.mining.secondsPerRock + 1e-9))
    expect(s.faces[face.id]).toBeLessThan(face.rocks)
    s = run(s, 20)
    expect(s.player.carry).toBe(backpackCapacity(s, quarry))
  })

  it('does nothing away from a face', () => {
    const s = run(createQuarryState(), 5)
    expect(s.player.carry).toBe(0)
  })

  it('regrows a face over time', () => {
    let s = at(createQuarryState(), face.pos)
    s = run(s, 4)
    const left = s.faces[face.id]!
    s = run(at(s, quarry.player.start), 3)
    expect(s.faces[face.id]).toBeGreaterThan(left)
  })
})

describe('crushing and the belt', () => {
  it('drops rock into the hopper, crushes it and lands it on the pile after the belt', () => {
    let s = { ...at(createQuarryState(), quarry.crusher.hopper) }
    s = { ...s, player: { ...s.player, carry: 8 } }
    s = run(s, 1)
    expect(s.player.carry).toBe(0)
    const tons = 8 * quarry.mining.tonsPerRock
    // Nothing reaches the pile before the belt has carried it.
    expect(s.piles[pile.id]).toBe(0)
    s = run(s, quarry.crusher.beltSeconds + tons / quarry.upgrades.crusher.levels[0]! + 1)
    expect(s.piles[pile.id]).toBeCloseTo(tons)
    expect(s.hopper).toBeCloseTo(0)
  })

  it('never overfills the hopper', () => {
    let s = at(createQuarryState(), quarry.crusher.hopper)
    s = { ...s, player: { ...s.player, carry: 100 } }
    s = tickQuarry(s, 0.5, STILL, content)
    expect(s.hopper).toBeLessThanOrEqual(quarry.crusher.hopperTons + 1e-9)
  })

  it('stops crushing when the pile is full', () => {
    let s = createQuarryState()
    s = { ...s, hopper: 3, piles: { [pile.id]: pile.capacityTons }, nextBuyerAt: 1e9 }
    s = run(s, 5)
    expect(s.hopper).toBe(3)
  })
})

describe('buyers', () => {
  it('drive in, load from the pile, pay at the counter, and the player collects it', () => {
    let s = createQuarryState()
    s = { ...s, piles: { [pile.id]: 10 } }
    s = run(s, quarry.buyers.firstDelaySeconds + 15)
    expect(s.stats.buyersServed).toBeGreaterThan(0)
    const type = quarry.buyers.types[0]!
    const earned = s.stats.buyersServed * type.loadTons * quarry.products.gravel!.pricePerTon
    expect(s.stacks[0]?.amount).toBeCloseTo(earned)
    s = run(at(s, quarry.office.counter), 0.1)
    expect(s.cash).toBeCloseTo(earned)
    expect(s.stacks).toHaveLength(0)
  })

  it('leave without paying when nothing is ever loaded', () => {
    const s = run(createQuarryState(), quarry.buyers.firstDelaySeconds + 60)
    expect(s.stats.buyersLost).toBeGreaterThan(0)
    expect(s.stats.buyersServed).toBe(0)
    expect(s.stacks).toHaveLength(0)
  })

  it('queue behind the bay without overlapping', () => {
    const s = run(createQuarryState(), 40)
    const waiting = s.buyers.filter((b) => b.phase !== 'leaving').map((b) => b.pos.x)
    expect(waiting.length).toBeGreaterThan(1)
    for (let i = 1; i < waiting.length; i++)
      expect(waiting[i]! - waiting[i - 1]!).toBeGreaterThanOrEqual(
        quarry.buyers.road.queueSpacing - 1e-6,
      )
  })
})

describe('upgrades', () => {
  it('drains cash into the backpack pad and levels it up', () => {
    let s = at(createQuarryState(), quarry.upgrades.backpack.pad)
    s = { ...s, cash: 1000 }
    s = run(s, quarry.player.buildSeconds + 0.1)
    expect(s.levels.backpack).toBe(1)
    expect(s.cash + s.paid.backpack).toBeCloseTo(1000 - quarry.upgrades.backpack.prices[0]!)
    expect(backpackCapacity(s, quarry)).toBe(quarry.upgrades.backpack.levels[1])
  })

  it('pays nothing it cannot afford', () => {
    let s = at(createQuarryState(), quarry.upgrades.crusher.pad)
    s = { ...s, cash: 20 }
    s = run(s, 3)
    expect(s.cash).toBe(0)
    expect(s.paid.crusher).toBe(20)
    expect(s.levels.crusher).toBe(0)
  })
})

describe('a quarry left alone', () => {
  it('sells what is on the pile and banks the cash at the offline rate', () => {
    let s = createQuarryState()
    s = { ...s, piles: { [pile.id]: 20 }, hopper: 4 }
    const away = simulateQuarryOffline(s, 600, content)
    expect(away.state.stats.tonsSold).toBeGreaterThan(0)
    expect(away.earned).toBeCloseTo(
      away.state.stats.tonsSold *
        quarry.products.gravel!.pricePerTon *
        content.economy.offline.efficiency,
    )
    expect(away.state.player.carry).toBe(0)
  })

  it('is deterministic', () => {
    const a = run(createQuarryState(), 60)
    const b = run(createQuarryState(), 60)
    expect(a).toEqual(b)
  })
})

describe('the opening minutes', () => {
  it('a player mining, carrying and collecting earns the first cash in under a minute', () => {
    let s = createQuarryState()
    let firstCash: number | null = null
    for (let trip = 0; trip < 8 && firstCash === null; trip++) {
      s = run(at(s, face.pos), backpackCapacity(s, quarry) * quarry.mining.secondsPerRock + 0.2)
      s = run(at(s, quarry.crusher.hopper), 2)
      s = run(at(s, quarry.office.counter), 4)
      if (s.cash > 0) firstCash = s.time
    }
    expect(firstCash).not.toBeNull()
    expect(firstCash!).toBeLessThan(60)
  })
})
