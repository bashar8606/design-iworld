import { describe, expect, it } from 'vitest'
import { tick } from '../tick.ts'
import { bayDef } from '../world.ts'
import { at, content, newGame, parkPlayer, withPads } from './helpers.ts'

function serveTimes(state: ReturnType<typeof newGame>, seconds: number) {
  let s = state
  const plugs: { by: string; t: number }[] = []
  for (let i = 0; i < seconds * 10; i++) {
    s = tick(s, 0.1)
    for (const e of s.events) if (e.type === 'carPlugged') plugs.push({ by: e.by, t: s.time })
  }
  return { s, plugs }
}

describe('technician', () => {
  it('plugs in waiting cars without the player', () => {
    const { s, plugs } = serveTimes(parkPlayer(withPads(newGame(), 'technician1')), 60)
    expect(plugs.length).toBeGreaterThan(0)
    expect(plugs.every((p) => p.by === 'staff')).toBe(true)
    expect(s.stats.carsServed).toBeGreaterThan(0)
  })

  it('is slower than the player', () => {
    const post = bayDef(content.map, 'bay1').post
    const byPlayer = serveTimes(at(newGame(), post.x, post.z), 20).plugs[0]!
    const byTech = serveTimes(parkPlayer(withPads(newGame(), 'technician1')), 20).plugs[0]!
    expect(byPlayer.by).toBe('player')
    expect(byTech.by).toBe('staff')
    expect(byTech.t).toBeGreaterThan(byPlayer.t + 1)
  })
})

describe('cashier and robot', () => {
  it('cashier collects cash stacks', () => {
    let s = parkPlayer(withPads(newGame(), 'technician1', 'cashier1'))
    let collected = 0
    for (let i = 0; i < 900; i++) {
      s = tick(s, 0.1)
      for (const e of s.events)
        if (e.type === 'cashCollected' && e.by === 'staff') collected += e.amount
    }
    expect(collected).toBeGreaterThan(0)
  })

  it('robot cleans dusty panels', () => {
    let s = parkPlayer(withPads(newGame(), 'robot1'))
    s = { ...s, panels: s.panels.map((p) => ({ ...p, dust: 0.8 })), nextArrivalAt: 1e9 }
    for (let i = 0; i < 600; i++) s = tick(s, 0.1)
    expect(s.panels[0]!.dust).toBeLessThan(0.2)
  })
})
