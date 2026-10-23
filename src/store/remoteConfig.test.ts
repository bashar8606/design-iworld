import { afterEach, describe, expect, it } from 'vitest'
import { getContent, setContentOverrides } from '../game/content.ts'
import { deserializeSave, serializeSave } from '../game/save.ts'
import { createInitialState } from '../game/state.ts'
import { tick } from '../game/tick.ts'
import { sanitizePatch } from './remoteConfig.ts'

afterEach(() => setContentOverrides({}))

describe('remote config', () => {
  it('applies valid balance values per map', () => {
    const patch = sanitizePatch({
      maps: { map1: { arrivals: { rushMultiplier: 4 }, pads: [{ id: 'charger2', price: 30 }] } },
    })!
    setContentOverrides(patch)
    const map = getContent('map1').map
    expect(map.arrivals.rushMultiplier).toBe(4)
    expect(map.pads.find((p) => p.id === 'charger2')!.price).toBe(30)
  })

  it('drops negative numbers, wrong types, unknown sections and shape-changing keys', () => {
    const patch = sanitizePatch({
      hack: { cash: 1e9 },
      economy: { offline: { capSeconds: -5, efficiency: 'lots' } },
      maps: {
        map1: {
          bounds: { minX: 0 },
          pads: [
            { id: 'charger2', pos: { x: 99, z: 99 } },
            { id: 'ghost', price: 1 },
          ],
        },
      },
    })
    setContentOverrides(patch ?? {})
    const content = getContent('map1')
    expect(content.economy.offline.capSeconds).toBe(28800)
    expect(content.economy.offline.efficiency).toBe(0.5)
    expect(content.map.bounds.minX).toBe(-7.6)
    expect(content.map.pads.find((p) => p.id === 'charger2')!.pos).toEqual({ x: -1.5, z: 2.2 })
    expect(content.map.pads.some((p) => p.id === 'ghost')).toBe(false)
  })

  it('never breaks a save: an existing save keeps loading and ticking under any patch', () => {
    let s = createInitialState()
    for (let i = 0; i < 300; i++) s = tick(s, 0.1)
    const json = serializeSave(s, 0)
    setContentOverrides(
      sanitizePatch({
        cars: { hatchback: { pricePerKwh: 0, patienceSeconds: 1 } },
        maps: { map1: { pads: [] } },
      }) ?? {},
    )
    let loaded = deserializeSave(json)!.state
    for (let i = 0; i < 300; i++) loaded = tick(loaded, 0.1)
    expect(Number.isFinite(loaded.cash)).toBe(true)
    expect(loaded.chargers.length).toBe(s.chargers.length)
  })

  it('ignores payloads that are not objects', () => {
    expect(sanitizePatch(null)).toBeNull()
    expect(sanitizePatch('nope')).toBeNull()
    expect(sanitizePatch([1, 2])).toBeNull()
  })
})
