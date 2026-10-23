import { getContent } from './content.ts'
import { NO_INPUT, tick } from './tick.ts'
import type { Content, GameState } from './types.ts'

/**
 * Seconds that count as "away", given the save time and the current wall clock (both ms).
 * Moving the clock backwards gives nothing; jumps forward are capped.
 */
export function awaySeconds(savedAtMs: number, nowMs: number, content: Content): number {
  const seconds = (nowMs - savedAtMs) / 1000
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.min(seconds, content.economy.offline.capSeconds)
}

/**
 * Fast-forwards the map without the player: staff and batteries keep working, earnings are
 * scaled by the offline efficiency and cash stacks are collected automatically.
 */
export function simulateOffline(
  state: GameState,
  seconds: number,
  content: Content = getContent(state.mapId),
): { state: GameState; earned: number; seconds: number } {
  const { stepSeconds, capSeconds } = content.economy.offline
  const total = Math.max(0, Math.min(seconds, capSeconds))
  const cashBefore = state.cash
  let s = state
  let left = total
  while (left > 1e-9) {
    const dt = Math.min(stepSeconds, left)
    s = tick(s, dt, NO_INPUT, { offline: true }, content)
    left -= dt
  }
  s = { ...s, events: [] }
  return { state: s, earned: Math.max(0, s.cash - cashBefore), seconds: total }
}
