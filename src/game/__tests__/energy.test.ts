import { describe, expect, it } from 'vitest'
import { tick } from '../tick.ts'
import { arrivalRate, sunIntensity } from '../world.ts'
import { atDayTime, content, newGame, parkPlayer, run, withPads } from './helpers.ts'

describe('sun and energy', () => {
  it('is dark at night and brightest at noon', () => {
    expect(sunIntensity(0.1, content.map)).toBe(0)
    expect(sunIntensity(0.9, content.map)).toBe(0)
    expect(sunIntensity(0.5, content.map)).toBeCloseTo(1)
  })

  it('panels charge the battery by day and the battery covers chargers at night', () => {
    let s = parkPlayer(withPads(atDayTime(newGame(), 0.45), 'battery1'))
    s = { ...s, nextArrivalAt: 1e9 }
    s = run(s, 30)
    expect(s.energy.stored).toBeGreaterThan(0)
    const storedByDay = s.energy.stored
    expect(storedByDay).toBeLessThanOrEqual(s.energy.capacity)

    // A car charging at night draws from the battery, never below zero.
    s = atDayTime(s, 0.9)
    s = tick(s, 0.1)
    expect(s.sun).toBe(0)
    expect(s.energy.produced).toBe(0)
  })

  it('never delivers more energy than produced plus what the battery gave', () => {
    let s = parkPlayer(withPads(newGame(), 'charger2', 'battery1'))
    for (let i = 0; i < 4000; i++) {
      const before = s.energy.stored
      s = tick(s, 0.1, { move: { x: 0, z: 0 } })
      const kwh = content.map.energy.kwhPerKwSecond * 0.1
      const supplied = s.energy.produced * kwh + Math.max(0, before - s.energy.stored)
      expect(s.energy.delivered * kwh).toBeLessThanOrEqual(supplied + 1e-6)
      expect(s.energy.stored).toBeGreaterThanOrEqual(0)
      expect(s.energy.stored).toBeLessThanOrEqual(s.energy.capacity + 1e-6)
    }
  })

  it('dust lowers panel output until the row is cleaned', () => {
    let s = parkPlayer(atDayTime(newGame(), 0.5))
    s = { ...s, nextArrivalAt: 1e9 }
    const clean = tick(s, 0.1).energy.produced
    const dusty = tick({ ...s, panels: s.panels.map((p) => ({ ...p, dust: 1 })) }, 0.1).energy
      .produced
    expect(dusty).toBeCloseTo(clean * (1 - content.map.dust.maxOutputLoss), 1)
  })
})

describe('arrivals', () => {
  it('peaks in the evening rush', () => {
    const s = newGame()
    const morning = arrivalRate(atDayTime(s, 0.35), content)
    const rush = arrivalRate(atDayTime(s, content.map.arrivals.rushTime), content)
    const lateNight = arrivalRate(atDayTime(s, 0.05), content)
    expect(rush).toBeGreaterThan(morning * 2)
    expect(lateNight).toBeLessThan(morning)
  })

  it('spawns more cars during the rush than in the same time at midday', () => {
    const count = (dayTime: number) => {
      let s = parkPlayer(atDayTime(newGame(3), dayTime))
      s = { ...s, nextArrivalAt: s.time }
      let spawned = 0
      for (let i = 0; i < 300; i++) {
        const next = tick(s, 0.1)
        spawned += next.nextCarId - s.nextCarId
        s = next
      }
      return spawned
    }
    expect(count(content.map.arrivals.rushTime - 0.04)).toBeGreaterThan(count(0.4))
  })
})
