import { describe, expect, it } from 'vitest'
import economy from '../content/economy.json'
import { TICKS_PER_SECOND, createInitialState, elapsedSeconds, tick } from './state.ts'

describe('game state', () => {
  it('starts with the configured money', () => {
    expect(createInitialState()).toEqual({ tick: 0, money: economy.startingMoney })
  })

  it('advances one tick at a time without mutating', () => {
    const start = createInitialState()
    const next = tick(start)
    expect(next.tick).toBe(1)
    expect(start.tick).toBe(0)
  })

  it('runs 10 ticks per second', () => {
    let state = createInitialState()
    for (let i = 0; i < TICKS_PER_SECOND; i++) state = tick(state)
    expect(elapsedSeconds(state)).toBeCloseTo(1)
  })
})
