import { describe, expect, it } from 'vitest'
import { padDef } from '../world.ts'
import { at, content, newGame, run, withPads } from './helpers.ts'

describe('build pads', () => {
  it('drain cash while the player stands on them and build when paid', () => {
    const pad = padDef(content, 'charger2')
    let s = { ...at(newGame(), pad.pos.x, pad.pos.z), cash: pad.price + 5, nextArrivalAt: 1e9 }
    s = run(s, 0.3)
    expect(s.pads.charger2!.paid).toBeGreaterThan(0)
    expect(s.pads.charger2!.built).toBe(false)
    s = run(s, 3)
    expect(s.pads.charger2!.built).toBe(true)
    expect(s.cash).toBeCloseTo(5)
    expect(s.chargers.map((c) => c.id)).toContain('charger2')
  })

  it('keep partial payments when the player walks off', () => {
    const pad = padDef(content, 'charger2')
    let s = { ...at(newGame(), pad.pos.x, pad.pos.z), cash: 8, nextArrivalAt: 1e9 }
    s = run(s, 3)
    expect(s.pads.charger2!.paid).toBeCloseTo(8)
    expect(s.cash).toBe(0)
    expect(s.pads.charger2!.built).toBe(false)
  })

  it('stay hidden until the pads they depend on are built', () => {
    const pad = padDef(content, 'panel2')
    let s = { ...at(newGame(), pad.pos.x, pad.pos.z), cash: 1000, nextArrivalAt: 1e9 }
    s = run(s, 2)
    expect(s.pads.panel2!.paid).toBe(0)
    s = withPads(s, 'charger2')
    s = run(s, 3)
    expect(s.pads.panel2!.built).toBe(true)
  })

  it('a hiring pad adds a technician', () => {
    const s = withPads(newGame(), 'technician1')
    expect(s.staff).toHaveLength(1)
    expect(s.staff[0]!.kind).toBe('technician')
  })
})
