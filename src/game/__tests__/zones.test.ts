import { describe, expect, it } from 'vitest'
import { deserializeSave, serializeSave } from '../save.ts'
import { openPads, padDef, zoneOwned } from '../world.ts'
import { at, content, newGame, run, walkTo, withPads } from './helpers.ts'

describe('zones', () => {
  it('start with only the roadside plot owned', () => {
    const s = newGame()
    const owned = (content.map.zones ?? []).filter((z) => zoneOwned(s, content.map, z.id))
    expect(owned.map((z) => z.id)).toEqual(['roadside'])
  })

  it('keep pads in land not yet bought closed', () => {
    const s = withPads(newGame(), 'charger2', 'panel2', 'battery1', 'technician1')
    const open = openPads(s, content).map((p) => p.id)
    expect(open).toContain('landRestStop')
    expect(open).not.toContain('cafe')
    expect(open).not.toContain('charger3')
  })

  it('open the zone and its pads once the land pad is paid for', () => {
    const land = padDef(content, 'landRestStop')
    let s = withPads(newGame(), 'charger2', 'panel2', 'battery1', 'technician1')
    s = { ...at(s, land.pos.x, land.pos.z), cash: land.price, nextArrivalAt: 1e9 }
    s = run(s, 3)
    expect(zoneOwned(s, content.map, 'restStop')).toBe(true)
    expect(openPads(s, content).map((p) => p.id)).toEqual(
      expect.arrayContaining(['cafe', 'charger3']),
    )
  })

  it('stop the player at the fence of land they do not own', () => {
    let s = { ...at(newGame(), 0, 2), nextArrivalAt: 1e9 }
    s = run(s, 4, walkTo({ x: 0, z: 9 }))
    expect(s.player.pos.z).toBeCloseTo(4, 1)
    s = withPads(s, 'landRestStop')
    s = run(s, 4, walkTo({ x: 0, z: 9 }))
    expect(s.player.pos.z).toBeGreaterThan(8.5)
  })

  it('give old saves the land under things they already built', () => {
    const s = withPads(newGame(), 'technician1', 'cafe')
    delete s.pads.landRestStop
    const loaded = deserializeSave(serializeSave(s, 1))!.state
    expect(loaded.pads.landRestStop!.built).toBe(true)
    expect(loaded.pads.landSolarField!.built).toBe(false)
  })
})
