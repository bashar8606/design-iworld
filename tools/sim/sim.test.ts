import { describe, expect, it } from 'vitest'
import { runBot } from './run.ts'
import { checkMilestones } from './report.ts'

describe('balancing sim', () => {
  it('plays the opening with the real game code and records milestones', () => {
    const result = runBot(
      { name: 'greedy', strategy: 'greedy', ads: false, schedule: 'engaged' },
      0.4,
    )
    expect(result.milestones.firstCashSeconds).not.toBeNull()
    expect(result.milestones.firstCashSeconds!).toBeLessThan(15)
    expect(result.purchases.length).toBeGreaterThan(3)
    expect(result.rows.length).toBeGreaterThan(10)
    const checks = checkMilestones(result, 'map1')
    expect(checks.find((c) => c.milestone === 'First new charger')?.ok).toBe(true)
  })
})
