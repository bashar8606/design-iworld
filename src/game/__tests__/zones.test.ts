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
    const s = withPads(newGame(), 'charger2', 'panel2', 'battery1')
    const open = openPads(s, content).map((p) => p.id)
    expect(open).toContain('landRestStop')
    // The technician's spot is by the staff hut, in the café & staff land.
    expect(open).not.toContain('technician1')
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
    const border = content.map.zones!.find((z) => z.id === 'roadside')!.bounds.minZ
    let s = { ...at(newGame(), 2, 2), nextArrivalAt: 1e9 }
    s = run(s, 4, walkTo({ x: 2, z: -6 }))
    expect(s.player.pos.z).toBeCloseTo(border, 1)
    s = withPads(s, 'landRestStop')
    s = run(s, 4, walkTo({ x: 2, z: -6 }))
    expect(s.player.pos.z).toBeLessThan(-5.5)
  })

  it('give old saves the land under things they already built', () => {
    const s = withPads(newGame(), 'technician1', 'cafe')
    delete s.pads.landRestStop
    const loaded = deserializeSave(serializeSave(s, 1))!.state
    expect(loaded.pads.landRestStop!.built).toBe(true)
    expect(loaded.pads.landSolarField!.built).toBe(false)
  })
})
