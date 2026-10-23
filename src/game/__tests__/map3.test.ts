import { describe, expect, it } from 'vitest'
import { getContent } from '../content.ts'
import { buildPadItem, createInitialState } from '../state.ts'
import { tick } from '../tick.ts'
import type { GameState } from '../types.ts'
import { isNight, openPads, windStrength } from '../world.ts'

const content = getContent('map3')
const { map } = content

function build(state: GameState, ...ids: string[]): GameState {
  const s = structuredClone(state)
  for (const id of ids)
    buildPadItem(
      s,
      map.pads.find((p) => p.id === id)!,
      content,
    )
  return s
}

/** Runs the clock forward to the first moment it is night. */
function untilNight(state: GameState): GameState {
  let s = state
  for (let i = 0; i < 4000 && !isNight(s.dayTime, map); i++) s = tick(s, 0.1)
  return s
}

describe('map 3, the ski lodge', () => {
  it('starts on the lodge lot with one wind turbine already turning', () => {
    const s = build(createInitialState('map3', { seed: 2 }), 'charger2')
    expect(s.turbines.map((t) => t.id)).toEqual(['turbine1'])
    expect(openPads(s, content).map((p) => p.id)).not.toContain('panel2')
  })

  it('wind turbines keep making power after dark', () => {
    let s = build(createInitialState('map3', { seed: 2 }), 'charger2')
    s = { ...untilNight(s), nextArrivalAt: 1e9 }
    s = tick(s, 0.1)
    expect(s.sun).toBe(0)
    expect(s.energy.produced).toBeGreaterThan(0)
    expect(s.energy.produced).toBeCloseTo(
      content.equipment.windTurbine.tiers[0]!.ratingKw! * windStrength(s.time, s.dayTime, map),
      3,
    )
  })

  it('the wind always blows a little and never more than full strength', () => {
    for (let t = 0; t < 2000; t += 7) {
      const w = windStrength(t, (t / 360) % 1, map)
      expect(w).toBeGreaterThanOrEqual(0.05)
      expect(w).toBeLessThanOrEqual(1)
    }
  })

  it('cold nights drain the batteries', () => {
    let s = build(createInitialState('map3', { seed: 2 }), 'battery1')
    s = { ...untilNight(s), nextArrivalAt: 1e9 }
    // No turbine topping it up, so only the cold is at work.
    s = { ...s, turbines: [], energy: { ...s.energy, stored: s.energy.capacity } }
    const before = s.energy.stored
    for (let i = 0; i < 100; i++) s = tick(s, 0.1)
    expect(s.energy.stored).toBeLessThan(before * 0.99)
  })
})
