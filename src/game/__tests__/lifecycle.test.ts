import { describe, expect, it } from 'vitest'
import { applyAction, greenCreditsFor, sellToUtility } from '../actions.ts'
import { awaySeconds, simulateOffline } from '../offline.ts'
import { deserializeSave, nextSavedAt, serializeSave } from '../save.ts'
import { tick } from '../tick.ts'
import { content, newGame, parkPlayer, run, withPads } from './helpers.ts'

describe('tick', () => {
  it('is pure and deterministic', () => {
    const s = newGame(42)
    const frozen = JSON.stringify(s)
    const a = run(s, 60)
    const b = run(s, 60)
    expect(JSON.stringify(s)).toBe(frozen)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('runs ten ticks per simulated second', () => {
    expect(run(newGame(), 1).time).toBeCloseTo(1)
  })
})

describe('offline earnings', () => {
  it('ignores clock moves backwards and caps jumps forward', () => {
    expect(awaySeconds(10_000, 5_000, content)).toBe(0)
    expect(awaySeconds(0, 48 * 3600 * 1000, content)).toBe(content.economy.offline.capSeconds)
    expect(nextSavedAt(10_000, 5_000)).toBe(10_000)
  })

  it('earns with a technician and nothing without staff', () => {
    const alone = simulateOffline(parkPlayer(newGame()), 1800)
    const staffed = simulateOffline(parkPlayer(withPads(newGame(), 'technician1')), 1800)
    expect(alone.earned).toBe(0)
    expect(staffed.earned).toBeGreaterThan(0)
    expect(staffed.state.pickups).toHaveLength(0)
  })
})

describe('saves', () => {
  it('round-trip and reject corrupt or future files', () => {
    const s = run(newGame(), 30)
    const json = serializeSave(s, 1234)
    const loaded = deserializeSave(json)
    expect(loaded?.savedAt).toBe(1234)
    expect(loaded?.state.time).toBeCloseTo(s.time)
    expect(deserializeSave('{oops')).toBeNull()
    expect(deserializeSave(JSON.stringify({ version: 999, savedAt: 1, state: {} }))).toBeNull()
  })

  it('survives JSON for every value (no Infinity or NaN)', () => {
    const s = run(newGame(), 120)
    const back = deserializeSave(serializeSave(s, 0))!.state
    expect(tick(back, 0.1).time).toBeCloseTo(s.time + 0.1)
    expect(back.nextContractAt).toBe(s.nextContractAt)
  })
})

describe('actions', () => {
  it('upgrades a charger when affordable', () => {
    const s = { ...newGame(), cash: 1000 }
    const next = applyAction(s, { type: 'upgrade', id: 'charger1' })
    expect(next.chargers[0]!.tier).toBe(1)
    expect(next.cash).toBe(1000 - content.equipment.charger.tiers[1]!.upgradePrice)
    expect(applyAction({ ...s, cash: 0 }, { type: 'upgrade', id: 'charger1' })).toEqual({
      ...s,
      cash: 0,
    })
  })

  it('solar boost doubles income for 10 minutes and stacks to the cap', () => {
    let s = newGame()
    for (let i = 0; i < 30; i++) s = applyAction(s, { type: 'reward', placement: 'solar_boost' })
    expect(s.boosts.adIncomeUntil - s.time).toBe(content.economy.boosts.adBoostCapSeconds)
  })

  it('selling a completed map awards Green Credits and starts the next map', () => {
    const s = {
      ...newGame(),
      mapComplete: true,
      stats: { ...newGame().stats, totalEarned: 1_000_000 },
    }
    const credits = greenCreditsFor(s, content)
    expect(credits).toBeGreaterThan(0)
    const next = sellToUtility(s, 'map1', content)
    expect(next.prestige.greenCredits).toBe(credits)
    expect(next.cash).toBe(content.map.initial.cash)
  })
})
