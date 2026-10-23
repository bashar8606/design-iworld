import { describe, expect, it } from 'vitest'
import { resumeFromSave, saveJson } from '../../store/lifecycle.ts'
import { type Businesses, quarryUnlocked, switchBusiness } from '../business.ts'
import { getContent } from '../content.ts'
import { getQuarryContent } from '../quarry/content.ts'
import { createQuarryState } from '../quarry/state.ts'
import { tickQuarry } from '../quarry/tick.ts'
import { deserializeSave, serializeSave } from '../save.ts'
import { buildPadItem, createInitialState } from '../state.ts'
import { padDef } from '../world.ts'

const HOUR = 3_600_000
const content = getContent('map1')
const quarry1 = getQuarryContent('quarry1').quarry

function staffedStation() {
  const s = createInitialState('map1', { seed: 3 })
  buildPadItem(s, padDef(content, 'technician1'), content)
  return { ...s, player: { ...s.player, pos: { x: 11, z: 17 } } }
}

function onStation(): Businesses {
  return { active: 'station', station: staffedStation(), quarry: null, inactiveSince: null }
}

describe('two businesses in one save', () => {
  it('reads a version 1 save as the station, with no quarry yet', () => {
    const station = createInitialState('map1')
    const v1 = JSON.stringify({ version: 1, savedAt: 5, state: station })
    const loaded = deserializeSave(v1)!
    expect(loaded.state.mapId).toBe('map1')
    expect(loaded.state.cash).toBe(station.cash)
    expect(loaded.business).toBe('station')
    expect(loaded.quarry).toBeNull()
    expect(loaded.inactiveSince).toBeNull()
  })

  it('keeps the quarry, the business on screen and when the other one was left', () => {
    const quarry = { ...createQuarryState(), cash: 42 }
    const json = serializeSave(createInitialState('map1'), 9, {
      business: 'quarry',
      quarry,
      inactiveSince: 1234,
    })
    const loaded = deserializeSave(json)!
    expect(loaded.business).toBe('quarry')
    expect(loaded.quarry).toEqual(quarry)
    expect(loaded.inactiveSince).toBe(1234)
  })

  it('falls back to the station when the saved quarry is broken', () => {
    const json = JSON.stringify({
      ...JSON.parse(serializeSave(createInitialState('map1'), 1)),
      business: 'quarry',
      quarry: { nope: true },
    })
    const loaded = deserializeSave(json)!
    expect(loaded.quarry).toBeNull()
    expect(loaded.business).toBe('station')
  })
})

describe('the quarry unlocks after map 1', () => {
  it('is locked on a fresh game, open once map 1 is complete or sold', () => {
    const fresh = createInitialState('map1')
    expect(quarryUnlocked(fresh)).toBe(false)
    expect(quarryUnlocked({ ...fresh, mapComplete: true })).toBe(true)
    const map2 = createInitialState('map2')
    expect(
      quarryUnlocked({ ...map2, prestige: { ...map2.prestige, mapsCompleted: ['map1'] } }),
    ).toBe(true)
    expect(quarryUnlocked(map2)).toBe(true)
  })
})

describe('switching business', () => {
  it('opens the quarry fresh and freezes the station from that moment', () => {
    const before = onStation()
    const { businesses, earned } = switchBusiness(before, 'quarry', 10 * HOUR)
    expect(businesses.active).toBe('quarry')
    expect(businesses.quarry?.player.pos).toEqual(quarry1.player.start)
    expect(businesses.station).toBe(before.station)
    expect(businesses.inactiveSince).toBe(10 * HOUR)
    expect(earned).toBe(0)
  })

  it('catches the station up for the time spent at the quarry', () => {
    const atQuarry = switchBusiness(onStation(), 'quarry', 0).businesses
    const back = switchBusiness(atQuarry, 'station', 2 * HOUR)
    expect(back.businesses.active).toBe('station')
    expect(back.awaySeconds).toBe(7200)
    expect(back.earned).toBeGreaterThan(0)
    expect(back.businesses.station.cash).toBeGreaterThan(atQuarry.station.cash)
    expect(back.businesses.station.time).toBeGreaterThan(atQuarry.station.time)
    // The quarry is now the one waiting.
    expect(back.businesses.inactiveSince).toBe(2 * HOUR)
    expect(back.businesses.quarry).toBe(atQuarry.quarry)
  })

  it('gives nothing for switching back and forth quickly or with the clock moved back', () => {
    const atQuarry = switchBusiness(onStation(), 'quarry', 10 * HOUR).businesses
    expect(switchBusiness(atQuarry, 'station', 10 * HOUR + 300).earned).toBe(0)
    expect(switchBusiness(atQuarry, 'station', 5 * HOUR).earned).toBe(0)
  })

  it('changes nothing when switching to the business already on screen', () => {
    const b = onStation()
    expect(switchBusiness(b, 'station', HOUR).businesses).toBe(b)
  })

  it('moves the quarry clock on for the time spent at the station', () => {
    const atQuarry = switchBusiness(onStation(), 'quarry', 0).businesses
    const atStation = switchBusiness(atQuarry, 'station', HOUR).businesses
    const again = switchBusiness(atStation, 'quarry', 2 * HOUR).businesses
    expect(again.quarry!.time - atQuarry.quarry!.time).toBeCloseTo(3600)
  })
})

describe('resuming the app', () => {
  it('catches up only the business that was on screen', () => {
    const station = staffedStation()
    const { json } = saveJson(station, null, 0, {
      business: 'quarry',
      quarry: createQuarryState(),
      inactiveSince: 0,
    })
    const resumed = resumeFromSave(json, 2 * HOUR)!
    expect(resumed.business).toBe('quarry')
    expect(resumed.quarry!.time).toBeCloseTo(7200)
    expect(resumed.state.time).toBe(station.time)
    expect(resumed.state.cash).toBe(station.cash)
    expect(resumed.earned).toBe(0)
  })
})

describe('walking around the quarry', () => {
  it('moves the player, turns them and keeps them inside the site', () => {
    let q = createQuarryState()
    for (let i = 0; i < 200; i++) q = tickQuarry(q, 0.1, { move: { x: 1, z: 0 } })
    expect(q.player.pos.x).toBe(quarry1.bounds.maxX)
    expect(q.player.heading).toBeCloseTo(Math.PI / 2)
    expect(q.player.moving).toBe(true)
    q = tickQuarry(q, 0.1, { move: { x: 0, z: 0 } })
    expect(q.player.moving).toBe(false)
    expect(q.time).toBeCloseTo(20.1)
  })

  it('runs the day and night clock like the station', () => {
    const q = createQuarryState()
    const later = tickQuarry(q, quarry1.day.lengthSeconds, { move: { x: 0, z: 0 } })
    expect(later.day).toBe(q.day + 1)
    expect(later.dayTime).toBeCloseTo(q.dayTime)
  })
})
