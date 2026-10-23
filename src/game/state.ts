import economy from '../content/economy.json'

export const TICKS_PER_SECOND = 10
export const TICK_SECONDS = 1 / TICKS_PER_SECOND

export interface GameState {
  /** Ticks simulated since the save was created. */
  tick: number
  money: number
}

export function createInitialState(): GameState {
  return { tick: 0, money: economy.startingMoney }
}

/** Advances the simulation by one fixed step. Pure: returns a new state. */
export function tick(state: GameState): GameState {
  return { ...state, tick: state.tick + 1 }
}

export function elapsedSeconds(state: GameState): number {
  return state.tick * TICK_SECONDS
}
