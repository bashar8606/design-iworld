// The app runs two businesses: the charging station (GameState) and the quarry (QuarryState).
// Only the one on screen ticks; the other is frozen with a timestamp and catches up through
// offline progress when the player switches back to it.
import { MAP_ORDER, getContent } from './content.ts'
import { awaySeconds, simulateOffline } from './offline.ts'
import { getQuarryContent } from './quarry/content.ts'
import { createQuarryState } from './quarry/state.ts'
import { simulateQuarryOffline } from './quarry/tick.ts'
import type { QuarryState } from './quarry/types.ts'
import type { GameState } from './types.ts'

export type BusinessId = 'station' | 'quarry'

export interface Businesses {
  active: BusinessId
  station: GameState
  /** Null until the quarry is opened for the first time. */
  quarry: QuarryState | null
  /** Wall-clock ms when the business that is not on screen was left, or null. */
  inactiveSince: number | null
}

/** The quarry opens once its charging map is finished (or a later map is being played). */
export function quarryUnlocked(station: GameState, quarryId = 'quarry1'): boolean {
  const { afterMap } = getQuarryContent(quarryId).quarry.unlock
  if (station.prestige.mapsCompleted.includes(afterMap)) return true
  if (station.mapId === afterMap) return station.mapComplete
  return MAP_ORDER.indexOf(station.mapId) > MAP_ORDER.indexOf(afterMap)
}

export interface SwitchResult {
  businesses: Businesses
  /** Cash the business switched to earned while it was off screen. */
  earned: number
  awaySeconds: number
}

/**
 * Puts `to` on screen: it catches up for the time it was away, and the one being left is
 * frozen from `nowMs`. Switching to the business already on screen changes nothing.
 */
export function switchBusiness(b: Businesses, to: BusinessId, nowMs: number): SwitchResult {
  if (b.active === to) return { businesses: b, earned: 0, awaySeconds: 0 }
  const since = b.inactiveSince ?? nowMs
  let { station, quarry } = b
  let earned = 0
  let away = 0
  if (to === 'station') {
    const content = getContent(station.mapId)
    const seconds = awaySeconds(since, nowMs, content)
    if (seconds >= 1) {
      const result = simulateOffline(station, seconds, content)
      station = result.state
      earned = result.earned
      away = result.seconds
    }
  } else if (quarry) {
    const content = getQuarryContent(quarry.quarryId)
    const seconds = awaySeconds(since, nowMs, content)
    if (seconds >= 1) {
      const result = simulateQuarryOffline(quarry, seconds, content)
      quarry = result.state
      earned = result.earned
      away = result.seconds
    }
  } else {
    quarry = createQuarryState()
  }
  return {
    businesses: { active: to, station, quarry, inactiveSince: nowMs },
    earned,
    awaySeconds: away,
  }
}
