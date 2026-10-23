import { dayClock, sunIntensity } from '../world.ts'
import { getQuarryContent } from './content.ts'
import type { QuarryState } from './types.ts'

export function createQuarryState(quarryId = 'quarry1'): QuarryState {
  const { quarry } = getQuarryContent(quarryId)
  const { day, dayTime } = dayClock(0, quarry)
  return {
    quarryId,
    time: 0,
    day,
    dayTime,
    sun: sunIntensity(dayTime, quarry),
    cash: 0,
    player: { pos: { ...quarry.player.start }, heading: 0, moving: false },
  }
}

/** True when a parsed save holds something shaped like a quarry. */
export function isQuarryState(value: unknown): value is QuarryState {
  if (typeof value !== 'object' || value === null) return false
  const q = value as Partial<QuarryState>
  return (
    typeof q.quarryId === 'string' &&
    typeof q.time === 'number' &&
    typeof q.player === 'object' &&
    q.player !== null &&
    typeof q.player.pos?.x === 'number'
  )
}
