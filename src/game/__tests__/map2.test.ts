import { afterEach, describe, expect, it } from 'vitest'
import { applyAction, greenCreditsFor } from '../actions.ts'
import { getContent, nextMapId, setContentOverrides } from '../content.ts'
import { createInitialState } from '../state.ts'
import { tick } from '../tick.ts'
import { itemPos } from '../world.ts'

afterEach(() => setContentOverrides({}))

describe('map 2 and the prestige reset', () => {
  it('selling a completed map 1 awards Green Credits and opens map 2', () => {
    const map1 = { ...createInitialState('map1'), mapComplete: true }
    const done = { ...map1, stats: { ...map1.stats, totalEarned: 400_000 } }
    const credits = greenCreditsFor(done, getContent('map1'))
    const next = applyAction(done, { type: 'sellToUtility' })
    expect(next.mapId).toBe('map2')
    expect(next.prestige.greenCredits).toBe(credits)
    expect(next.prestige.mapsCompleted).toEqual(['map1'])
    expect(nextMapId('map2')).toBe('map3')
    expect(nextMapId('map3')).toBe('map3')
  })

  it('cannot sell a map that is not complete', () => {
    const s = createInitialState('map1')
    expect(applyAction(s, { type: 'sellToUtility' })).toBe(s)
  })

  it('Green Credits buy permanent income levels that raise earnings', () => {
    const s = {
      ...createInitialState('map2'),
      prestige: { greenCredits: 100, incomeLevel: 0, mapsCompleted: ['map1'] },
    }
    const leveled = applyAction(s, { type: 'buyIncomeLevel' })
    expect(leveled.prestige.incomeLevel).toBe(1)
    expect(leveled.prestige.greenCredits).toBeLessThan(100)
  })

  it('starts with 50 kW chargers, sedans and taxis, and offers fleet contracts', () => {
    let s = createInitialState('map2', { seed: 4 })
    expect(
      s.chargers.every((c) => getContent('map2').equipment.charger.tiers[c.tier]!.powerKw === 50),
    ).toBe(true)
    s = { ...s, player: { ...s.player, pos: { x: -1.5, z: -0.5 } } }
    let contract = false
    const types = new Set<string>()
    for (let i = 0; i < 4000; i++) {
      s = tick(s, 0.1)
      contract ||= s.contract !== null
      for (const c of s.cars) types.add(c.type)
    }
    expect(contract).toBe(true)
    expect(types.has('taxi')).toBe(true)
    expect(types.has('sedan')).toBe(true)
  })

  it('builds carports over the bays, above the ground', () => {
    const pad = getContent('map2').map.pads.find((p) => p.id === 'carport2')!
    expect(itemPos(pad)).not.toEqual(pad.pos)
    expect(pad.buildY).toBeGreaterThan(2)
  })
})

describe('night rush live event', () => {
  it('is off by default and runs when remote config enables it', () => {
    const run = () => {
      let s = createInitialState('map1', { seed: 2 })
      let started = false
      for (let i = 0; i < 360 * 10 * 3.5; i++) {
        s = tick(s, 0.1)
        started ||= s.events.some((e) => e.type === 'eventStarted' && e.kind === 'nightRush')
      }
      return started
    }
    expect(run()).toBe(false)
    setContentOverrides({ events: { nightRush: { enabled: true } } })
    expect(run()).toBe(true)
  })
})
