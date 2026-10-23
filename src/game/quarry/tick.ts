import type { TickInput } from '../types.ts'
import { dayClock, sunIntensity } from '../world.ts'
import { getQuarryContent } from './content.ts'
import type { QuarryAllContent, QuarryState } from './types.ts'

/**
 * Advances a quarry by `dt` seconds. Pure: returns a new state. For now the quarry is an empty
 * site, so only the clock runs and the player walks around.
 */
export function tickQuarry(
  state: QuarryState,
  dt: number,
  input: TickInput,
  content: QuarryAllContent = getQuarryContent(state.quarryId),
): QuarryState {
  const { quarry } = content
  const time = state.time + dt
  const { day, dayTime } = dayClock(time, quarry)
  const len = Math.hypot(input.move.x, input.move.z)
  const k = len > 1 ? 1 / len : 1
  const mx = input.move.x * k
  const mz = input.move.z * k
  const moving = len > 0.05
  const b = quarry.bounds
  const player = moving
    ? {
        pos: {
          x: Math.max(b.minX, Math.min(b.maxX, state.player.pos.x + mx * quarry.player.speed * dt)),
          z: Math.max(b.minZ, Math.min(b.maxZ, state.player.pos.z + mz * quarry.player.speed * dt)),
        },
        heading: Math.atan2(mx, mz),
        moving,
      }
    : { ...state.player, moving }
  return { ...state, time, day, dayTime, sun: sunIntensity(dayTime, quarry), player }
}

/** Time spent away from the quarry (capped like the station's offline time). */
export function simulateQuarryOffline(
  state: QuarryState,
  seconds: number,
  content: QuarryAllContent = getQuarryContent(state.quarryId),
): { state: QuarryState; earned: number; seconds: number } {
  const total = Math.max(0, Math.min(seconds, content.economy.offline.capSeconds))
  const next = tickQuarry(state, total, { move: { x: 0, z: 0 } }, content)
  return { state: next, earned: 0, seconds: total }
}
