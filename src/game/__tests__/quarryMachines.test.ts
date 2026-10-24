import { describe, expect, it } from 'vitest'
import { getQuarryContent } from '../quarry/content.ts'
import { buildQuarryPad } from '../quarry/machines.ts'
import { routeLength } from '../quarry/route.ts'
import { createQuarryState, openQuarryPads, truckCapacity } from '../quarry/state.ts'
import { simulateQuarryOffline, tickQuarry } from '../quarry/tick.ts'
import type { QuarryState } from '../quarry/types.ts'

const content = getQuarryContent('quarry1')
const { quarry } = content
const STILL = { move: { x: 0, z: 0 } }
const PARKED = { x: 20, z: -14 }

/** A quarry with these pads built and the player parked out of the way. */
function withPads(...ids: string[]): QuarryState {
  const s = createQuarryState()
  s.player.pos = { ...PARKED }
  s.nextBuyerAt = 1e9
  for (const id of ids)
    buildQuarryPad(
      s,
      quarry.pads.find((p) => p.id === id)!,
      quarry,
    )
  return s
}

function run(s: QuarryState, seconds: number): QuarryState {
  for (let t = 0; t < seconds - 1e-9; t += 0.1) s = tickQuarry(s, 0.1, STILL, content)
  return s
}

describe('pads', () => {
  it('open in order: the loader first, then bench 2, then the excavator and trucks', () => {
    const ids = (s: QuarryState) => openQuarryPads(s, quarry).map((p) => p.id)
    expect(ids(createQuarryState())).toEqual(['loader'])
    expect(ids(withPads('loader'))).toEqual(['operator', 'bench2'])
    expect(ids(withPads('loader', 'bench2'))).toContain('excavator')
    expect(ids(withPads('loader', 'bench2'))).not.toContain('truck1')
    expect(ids(withPads('loader', 'bench2', 'excavator'))).toContain('truck1')
  })

  it('are bought by standing on them with enough cash', () => {
    let s = createQuarryState()
    const pad = quarry.pads.find((p) => p.id === 'loader')!
    s = { ...s, cash: pad.price + 10, player: { ...s.player, pos: { ...pad.pos } } }
    s = run(s, quarry.player.buildSeconds + 0.2)
    expect(s.pads.loader?.built).toBe(true)
    expect(s.loader).not.toBeNull()
    expect(s.cash).toBeCloseTo(10)
  })
})

describe('the wheel loader', () => {
  it('feeds the hopper from the faces on its own', () => {
    let s = withPads('loader')
    s = run(s, 30)
    expect(s.stats.rocksMined).toBeGreaterThan(0)
    expect(s.stats.tonsCrushed).toBeGreaterThan(0)
    expect(s.player.carry).toBe(0)
  })
})

describe('the excavator and trucks', () => {
  it('haul rock from bench 2 up to the hopper', () => {
    let s = withPads('loader', 'bench2', 'excavator', 'truck1')
    s.loader = null // only the truck feeds the hopper
    s = run(s, 60)
    expect(s.stats.tonsCrushed).toBeGreaterThanOrEqual(truckCapacity(s, quarry))
  })

  it('take about as long per trip as the road, loading and tipping add up to', () => {
    let s = withPads('loader', 'bench2', 'excavator', 'truck1')
    s.loader = null
    s.digBuffer = 100
    s.broken = 100
    const t = quarry.machines.trucks
    const cap = truckCapacity(s, quarry)
    const length = routeLength(t.route)
    const trip =
      length / t.speedEmpty +
      length / t.speedLoaded +
      cap / t.loadTonsPerSecond +
      cap / t.tipTonsPerSecond
    // Two trips plus the first drive down; the crusher keeps the hopper clear enough.
    s = { ...s, levels: { ...s.levels, crusher: 6 } }
    s = run(s, length / t.speedEmpty + 2 * trip + 2)
    expect(s.stats.tonsCrushed + s.hopper).toBeGreaterThanOrEqual(2 * cap - 1e-6)
  })

  it('keep their distance in a lane', () => {
    let s = withPads('loader', 'bench2', 'excavator', 'truck1', 'truck2', 'truck3')
    s.loader = null
    for (let i = 0; i < 600; i++) {
      s = tickQuarry(s, 0.1, STILL, content)
      for (const lane of [
        s.trucks.filter((t) => t.phase === 'hauling' || t.phase === 'tipping'),
        s.trucks.filter((t) => t.phase === 'returning' || t.phase === 'loading'),
      ]) {
        const ds = lane.map((t) => t.d).sort((a, b) => a - b)
        for (let k = 1; k < ds.length; k++)
          expect(ds[k]! - ds[k - 1]!).toBeGreaterThanOrEqual(quarry.machines.trucks.gap - 1e-6)
      }
    }
  })

  it('dig faster after a blast', () => {
    const slow = run({ ...withPads('loader', 'bench2', 'excavator'), broken: 0 }, 5)
    const fast = run({ ...withPads('loader', 'bench2', 'excavator'), broken: 50 }, 5)
    expect(fast.digBuffer).toBeGreaterThan(slow.digBuffer * 2)
  })
})

describe('the drill rig', () => {
  it('blasts on a timer, adding broken rock and refilling the top faces', () => {
    let s = withPads('loader', 'bench2', 'excavator', 'drill')
    s.loader = null
    s = { ...s, broken: 0, faces: Object.fromEntries(quarry.faces.map((f) => [f.id, 0])) }
    s = run(s, 4)
    expect(s.broken).toBeGreaterThan(0)
    for (const f of quarry.faces) expect(s.faces[f.id]).toBeGreaterThanOrEqual(f.rocks - 0.5)
  })
})

describe('staff', () => {
  it('the foreman banks the cash at the counter', () => {
    let s = withPads('loader', 'bench2', 'foreman')
    s = { ...s, stacks: [{ id: 1, amount: 50, pos: { ...quarry.office.counter } }] }
    s = run(s, 0.1)
    expect(s.cash).toBe(50)
    expect(s.stacks).toHaveLength(0)
  })

  it('machines stand still while you are away, unless there is an operator', () => {
    const base = withPads('loader', 'bench2', 'excavator', 'truck1')
    const without = simulateQuarryOffline(base, 600, content).state
    const withOperator = simulateQuarryOffline(
      (() => {
        const s = structuredClone(base)
        buildQuarryPad(
          s,
          quarry.pads.find((p) => p.id === 'operator')!,
          quarry,
        )
        return s
      })(),
      600,
      content,
    ).state
    expect(without.stats.tonsCrushed).toBe(0)
    expect(withOperator.stats.tonsCrushed).toBeGreaterThan(20)
  })

  it('the mechanic makes trucks faster', () => {
    const plain = run(withPads('loader', 'bench2', 'excavator', 'truck1'), 1.5)
    const fixed = run(
      withPads('loader', 'bench2', 'excavator', 'truck1', 'truck2', 'mechanic'),
      1.5,
    )
    const length = routeLength(quarry.machines.trucks.route)
    expect(length - fixed.trucks[0]!.d).toBeGreaterThan(length - plain.trucks[0]!.d)
  })
})

describe('buyers', () => {
  it('tipper lorries only come once bench 2 is open', () => {
    const before = run({ ...createQuarryState(), piles: { gravel: 30 } }, 300)
    expect(before.stats.buyersServed).toBeGreaterThan(0)
    const lorries = (s: QuarryState) => s.buyers.filter((b) => b.type === 'lorry').length
    let after = withPads('loader', 'bench2')
    after = { ...after, nextBuyerAt: 0 }
    let seen = 0
    for (let i = 0; i < 3000; i++) {
      after = tickQuarry(after, 0.1, STILL, content)
      seen = Math.max(seen, lorries(after))
    }
    expect(seen).toBeGreaterThan(0)
  })
})
