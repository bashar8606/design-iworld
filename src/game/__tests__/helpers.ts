import { getContent } from '../content.ts'
import { buildPadItem, createInitialState } from '../state.ts'
import { NO_INPUT, tick } from '../tick.ts'
import type { GameState, TickInput } from '../types.ts'
import { padDef } from '../world.ts'

export const content = getContent('map1')

export function newGame(seed = 7): GameState {
  return createInitialState('map1', { seed })
}

export function run(
  state: GameState,
  seconds: number,
  input: TickInput | ((s: GameState) => TickInput) = NO_INPUT,
  dt = 0.1,
): GameState {
  let s = state
  const steps = Math.round(seconds / dt)
  for (let i = 0; i < steps; i++) s = tick(s, dt, typeof input === 'function' ? input(s) : input)
  return s
}

/** Builds pads directly, skipping payment. */
export function withPads(state: GameState, ...padIds: string[]): GameState {
  const s = structuredClone(state)
  for (const id of padIds) buildPadItem(s, padDef(content, id), content)
  return s
}

/** Moves the player somewhere out of reach of every bay, pad and panel. */
export function parkPlayer(state: GameState): GameState {
  return { ...state, player: { ...state.player, pos: { x: 11.5, z: 17.5 } } }
}

export function at(state: GameState, x: number, z: number): GameState {
  return { ...state, player: { ...state.player, pos: { x, z } } }
}

export function walkTo(target: { x: number; z: number }) {
  return (s: GameState): TickInput => {
    const dx = target.x - s.player.pos.x
    const dz = target.z - s.player.pos.z
    const d = Math.hypot(dx, dz)
    return d < 0.15 ? NO_INPUT : { move: { x: dx / d, z: dz / d } }
  }
}

/** Sets the clock to a fraction of a day. */
export function atDayTime(state: GameState, dayTime: number): GameState {
  const { lengthSeconds, startTime } = content.map.day
  const time = (dayTime - startTime + (dayTime < startTime ? 1 : 0)) * lengthSeconds
  return { ...state, time, dayTime }
}
