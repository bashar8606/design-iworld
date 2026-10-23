import { describe, expect, it } from 'vitest'
import { STRESS_PANEL_ROWS, createStressState } from '../stress.ts'
import { tick } from '../tick.ts'

describe('stress mode', () => {
  it('builds the full layout at night and fills up with about 30 cars', () => {
    let s = createStressState()
    expect(s.panels).toHaveLength(STRESS_PANEL_ROWS)
    expect(s.chargers).toHaveLength(6)
    expect(s.facilities.cafe).toBe(true)
    expect(s.sun).toBe(0)
    let peak = 0
    for (let i = 0; i < 600; i++) {
      s = tick(s, 0.1)
      peak = Math.max(peak, s.cars.length)
    }
    expect(peak).toBeGreaterThanOrEqual(25)
    expect(s.cars.some((c) => c.phase === 'charging')).toBe(true)
  })
})
