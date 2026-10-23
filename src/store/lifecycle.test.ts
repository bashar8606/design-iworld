import { describe, expect, it } from 'vitest'
import { buildPadItem, createInitialState } from '../game/state.ts'
import { getContent } from '../game/content.ts'
import { tick } from '../game/tick.ts'
import { padDef } from '../game/world.ts'
import { catchUp, resumeFromSave, saveJson } from './lifecycle.ts'

const content = getContent('map1')
const HOUR = 3_600_000

function staffedGame() {
  const s = createInitialState('map1', { seed: 3 })
  buildPadItem(s, padDef(content, 'technician1'), content)
  return { ...s, player: { ...s.player, pos: { x: 11, z: 17 } } }
}

describe('save and resume', () => {
  it('earns offline money with staff and shows how long the player was away', () => {
    const { json } = saveJson(staffedGame(), null, 0)
    const resumed = resumeFromSave(json, 2 * HOUR)!
    expect(resumed.awaySeconds).toBe(7200)
    expect(resumed.earned).toBeGreaterThan(0)
    expect(resumed.state.cash).toBeCloseTo(resumed.earned)
  })

  it('gives nothing when the clock moved backwards, and keeps the later save time', () => {
    const { json } = saveJson(staffedGame(), null, 10 * HOUR)
    const resumed = resumeFromSave(json, 5 * HOUR)!
    expect(resumed.earned).toBe(0)
    expect(resumed.savedAt).toBe(10 * HOUR)
  })

  it('caps a clock jumped far forward at 8 hours', () => {
    const resumed = catchUp(staffedGame(), 0, 1000 * HOUR)
    expect(resumed.awaySeconds).toBe(content.economy.offline.capSeconds)
  })

  it('cannot farm earnings by moving the clock back and forth', () => {
    const start = staffedGame()
    const first = catchUp(start, 0, 8 * HOUR)
    // Clock set back to the original time: the save time stays at 8 h, so nothing more is earned.
    const second = catchUp(first.state, first.savedAt, 0)
    expect(second.earned).toBe(0)
    const third = catchUp(second.state, second.savedAt, 8 * HOUR)
    expect(third.earned).toBe(0)
  })

  it('keeps a partly paid pad when the app is closed mid-purchase', () => {
    const pad = padDef(content, 'charger2')
    let s = { ...createInitialState('map1'), cash: 10, nextArrivalAt: 1e9 }
    s = { ...s, player: { ...s.player, pos: { ...pad.pos } } }
    for (let i = 0; i < 5; i++) s = tick(s, 0.1)
    const paid = s.pads.charger2!.paid
    expect(paid).toBeGreaterThan(0)
    // Force-quit: only what was saved survives.
    const { json } = saveJson(s, null, 0)
    const back = resumeFromSave(json, 0)!
    expect(back.state.pads.charger2!.paid).toBeCloseTo(paid)
    expect(back.state.cash + back.state.pads.charger2!.paid).toBeCloseTo(10)
  })

  it('treats a corrupt save as no save', () => {
    expect(resumeFromSave('not json', 0)).toBeNull()
  })
})
