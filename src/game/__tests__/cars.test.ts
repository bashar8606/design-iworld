import { describe, expect, it } from 'vitest'
import { tick } from '../tick.ts'
import { bayDef } from '../world.ts'
import { at, content, newGame, parkPlayer, run } from './helpers.ts'

describe('cars', () => {
  it('drive in, wait for a plug, charge, pay and leave', () => {
    let s = parkPlayer(newGame())
    s = run(s, 8)
    const car = s.cars.find((c) => c.bayId === 'bay1')
    expect(car?.phase).toBe('waiting')

    const post = bayDef(content.map, 'bay1').post
    s = at(s, post.x, post.z)
    let paid = 0
    for (let i = 0; i < 400 && paid === 0; i++) {
      s = tick(s, 0.1)
      for (const e of s.events) if (e.type === 'carPaid') paid = e.amount
    }
    expect(paid).toBeGreaterThan(0)
    expect(s.pickups.length).toBe(1)
    expect(s.stats.carsServed).toBe(1)
  })

  it('leave angry when nobody plugs them in before their patience runs out', () => {
    let s = parkPlayer(newGame())
    let lost = 0
    for (let i = 0; i < 900; i++) {
      s = tick(s, 0.1)
      lost += s.events.filter((e) => e.type === 'carLost').length
    }
    expect(lost).toBeGreaterThan(0)
    expect(s.stats.carsLost).toBe(lost)
    expect(s.stats.carsServed).toBe(0)
  })

  it('drive past when the queue is full', () => {
    let s = parkPlayer(newGame())
    // Every charger busy, cars arriving constantly.
    s = { ...s, chargers: s.chargers.map((c) => ({ ...c, carId: 999 })) }
    let passed = false
    for (let i = 0; i < 200 && !passed; i++) {
      s = tick({ ...s, nextArrivalAt: s.time }, 0.1)
      passed = s.cars.some((c) => c.phase === 'passing')
    }
    expect(s.queue).toHaveLength(content.map.queueSlots.length)
    expect(passed).toBe(true)
  })

  it('collecting the cash stack adds it to cash and records the first cash time', () => {
    let s = newGame()
    const post = bayDef(content.map, 'bay1').post
    s = at(s, post.x, post.z)
    s = run(s, 25)
    const stack = s.pickups[0]
    expect(stack).toBeDefined()
    const before = s.cash
    s = at(s, stack!.pos.x, stack!.pos.z)
    s = tick(s, 0.1)
    expect(s.cash).toBeCloseTo(before + stack!.amount)
    expect(s.milestones.firstCashAt).not.toBeNull()
  })
})
