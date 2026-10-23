import { describe, expect, it } from 'vitest'
import { MAP_ORDER, getContent } from '../content.ts'
import { chargePort, footprints, layoutProblems, overlaps } from '../layout.ts'
import { deserializeSave, serializeSave } from '../save.ts'
import { createInitialState } from '../state.ts'
import { tick } from '../tick.ts'

/** Maps still on the old layout; they move to the standard layout after map 1 is approved. */
const PENDING = new Set(['map2', 'map3'])

describe('map layouts', () => {
  for (const id of MAP_ORDER) {
    it.skipIf(PENDING.has(id))(
      `${id}: nothing overlaps, blocks the lane or crosses a fence`,
      () => {
        expect(layoutProblems(getContent(id))).toEqual([])
      },
    )
  }

  it('finds an overlap when two things stand in the same place', () => {
    const base = getContent('map1')
    const cafe = base.map.pads.find((p) => p.kind === 'cafe')!
    const battery = base.map.pads.find((p) => p.id === 'battery2')!
    const moved = {
      ...base,
      map: {
        ...base.map,
        pads: base.map.pads.map((p) => (p.id === battery.id ? { ...p, pos: { ...cafe.pos } } : p)),
      },
    }
    expect(layoutProblems(moved).some((p) => p.includes('battery battery2'))).toBe(true)
  })

  it('puts the charging cable on the side of the car facing the charger', () => {
    const content = getContent('map1')
    const bay = content.map.bays[0]!
    for (const type of Object.keys(content.map.carTypes)) {
      const port = chargePort(bay, content, type)
      const def = content.cars[type]!
      // Between the car's middle and its nose, on its left (−z when it faces +x).
      expect(port.x).toBeGreaterThan(bay.car.x - 0.1)
      expect(port.x).toBeLessThan(bay.car.x + def.length / 2)
      expect(port.z).toBeLessThan(bay.car.z)
    }
  })

  it('keeps every footprint off the entry lane on map 1', () => {
    const all = footprints(getContent('map1'))
    const lane = all.find((f) => f.kind === 'lane')!
    // The way out crosses the lane on purpose; everything built stays off it.
    const built = all.filter((f) => !['lane', 'route', 'plaza'].includes(f.kind))
    expect(built.filter((f) => overlaps(f, lane))).toEqual([])
  })

  it('moves staff, cash and cars when a save from an older layout loads', () => {
    const s = createInitialState('map1')
    const old = {
      ...s,
      layoutVersion: 1,
      staff: [
        {
          id: 'technician1',
          kind: 'technician' as const,
          level: 0,
          pos: { x: 4.4, z: 0.8 },
          home: { x: 4.4, z: 0.8 },
          target: null,
          timer: 0,
        },
      ],
      cars: s.cars,
      nextArrivalAt: 0,
    }
    const loaded = deserializeSave(serializeSave(old, 1))!.state
    const pad = getContent('map1').map.pads.find((p) => p.id === 'technician1')!
    expect(loaded.staff[0]!.home).toEqual(pad.pos)
    expect(loaded.cars).toEqual([])
    expect(loaded.layoutVersion).toBe(getContent('map1').map.layoutVersion)
  })

  it('sends happy drivers out through the car wash once it is built', () => {
    const content = getContent('map1')
    const wash = content.map.pads.find((p) => p.kind === 'carWash')!
    const through = (built: boolean) => {
      let s = { ...createInitialState('map1', { seed: 3 }), nextArrivalAt: 0 }
      if (built) s = { ...s, facilities: { ...s.facilities, carWash: true } }
      s = { ...s, player: { ...s.player, pos: { ...content.map.bays[0]!.post } } }
      let passed = false
      for (let i = 0; i < 3000 && !passed; i++) {
        s = tick(s, 0.1)
        passed = s.cars.some(
          (c) =>
            c.phase === 'leaving' &&
            Math.abs(c.pos.x - wash.pos.x) < 0.5 &&
            Math.abs(c.pos.z - wash.pos.z) < 2,
        )
      }
      return passed
    }
    expect(through(true)).toBe(true)
    expect(through(false)).toBe(false)
  })
})
