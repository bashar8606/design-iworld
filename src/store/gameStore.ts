import { create } from 'zustand'
import { type GameAction, applyAction } from '../game/actions.ts'
import { type BusinessId, type SwitchResult, switchBusiness } from '../game/business.ts'
import { tickQuarry } from '../game/quarry/tick.ts'
import type { QuarryState } from '../game/quarry/types.ts'
import { TICK_SECONDS, createInitialState } from '../game/state.ts'
import { tick } from '../game/tick.ts'
import type { GameState, TickInput, Vec2 } from '../game/types.ts'
import { emitGameEvents } from './events.ts'

export interface GameStore {
  /** The charging station. */
  state: GameState
  /** The state one tick earlier, for interpolating positions between ticks. */
  prev: GameState
  /** Which business is on screen and ticking. */
  business: BusinessId
  /** The quarry, once opened; it only ticks while it is on screen. */
  quarry: QuarryState | null
  quarryPrev: QuarryState | null
  /** Wall-clock ms when the business that is not on screen was left. */
  inactiveSince: number | null
  /** Shows the other business; it catches up for the time it was away. */
  switchTo: (business: BusinessId, nowMs?: number) => SwitchResult
  /** Restores both businesses from a save. */
  restore: (b: {
    business: BusinessId
    quarry: QuarryState | null
    inactiveSince: number | null
  }) => void
  replaceQuarry: (quarry: QuarryState) => void
  /** performance.now() of the latest tick. */
  tickedAt: number
  input: TickInput
  paused: boolean
  /** Simulation speed multiplier (debug and the scripted store demo). */
  speed: number
  setMove: (move: Vec2) => void
  dispatch: (action: GameAction) => void
  replace: (state: GameState) => void
  setPaused: (paused: boolean) => void
  setSpeed: (speed: number) => void
  /** When set, drives the player instead of the joystick (store demo). */
  autopilot: ((state: GameState) => TickInput) | null
  setAutopilot: (autopilot: ((state: GameState) => TickInput) | null) => void
}

type ActionListener = (action: GameAction) => void
const actionListeners = new Set<ActionListener>()

/** Called after every action that changed the state (purchases, rewards, upgrades). */
export function onAction(listener: ActionListener): () => void {
  actionListeners.add(listener)
  return () => actionListeners.delete(listener)
}

export const useGame = create<GameStore>()((set, get) => ({
  state: createInitialState(),
  prev: createInitialState(),
  tickedAt: 0,
  input: { move: { x: 0, z: 0 } },
  paused: false,
  speed: 1,
  setMove: (move) => set({ input: { move } }),
  dispatch: (action) => {
    const next = applyAction(get().state, action)
    if (next === get().state) return
    emitGameEvents(next.events)
    set({ state: { ...next, events: [] }, prev: get().prev })
    for (const listener of actionListeners) listener(action)
  },
  replace: (state) => set({ state, prev: state, tickedAt: performance.now() }),
  business: 'station',
  quarry: null,
  quarryPrev: null,
  inactiveSince: null,
  switchTo: (business, nowMs = Date.now()) => {
    const s = get()
    const result = switchBusiness(
      { active: s.business, station: s.state, quarry: s.quarry, inactiveSince: s.inactiveSince },
      business,
      nowMs,
    )
    const b = result.businesses
    set({
      business: b.active,
      state: b.station,
      prev: b.station,
      quarry: b.quarry,
      quarryPrev: b.quarry,
      inactiveSince: b.inactiveSince,
      tickedAt: performance.now(),
    })
    return result
  },
  restore: ({ business, quarry, inactiveSince }) =>
    set({
      business: business === 'quarry' && quarry ? 'quarry' : 'station',
      quarry,
      quarryPrev: quarry,
      inactiveSince,
    }),
  replaceQuarry: (quarry) => set({ quarry, quarryPrev: quarry, tickedAt: performance.now() }),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed }),
  autopilot: null,
  setAutopilot: (autopilot) => set({ autopilot }),
}))

export const gameStore = useGame

/** Fraction of the way from the previous tick to the next one, for interpolation. */
export function tickAlpha(now = performance.now()): number {
  const { tickedAt, paused } = useGame.getState()
  if (paused) return 1
  return Math.min(1, Math.max(0, (now - tickedAt) / (TICK_SECONDS * 1000)))
}

const MAX_STEPS_PER_FRAME = 8
let running = false
let last = 0
let accumulator = 0

/** Runs tick() at a fixed 10 Hz from requestAnimationFrame, outside React. */
export function startGameLoop(): () => void {
  if (running) return () => {}
  running = true
  last = performance.now()
  let frame = 0
  const loop = (now: number) => {
    if (!running) return
    const store = useGame.getState()
    const elapsed = Math.min(1, (now - last) / 1000)
    last = now
    if (!store.paused && store.business === 'quarry' && store.quarry) {
      accumulator += elapsed * store.speed
      let quarry = store.quarry
      let prev = quarry
      let steps = 0
      while (accumulator >= TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
        prev = quarry
        quarry = tickQuarry(quarry, TICK_SECONDS, useGame.getState().input)
        accumulator -= TICK_SECONDS
        steps++
      }
      if (steps > 0) {
        if (accumulator > TICK_SECONDS) accumulator = 0
        useGame.setState({ quarry, quarryPrev: prev, tickedAt: now })
      }
    } else if (!store.paused) {
      accumulator += elapsed * store.speed
      let steps = 0
      let { state, prev } = store
      const events = []
      while (
        accumulator >= TICK_SECONDS &&
        steps < MAX_STEPS_PER_FRAME * Math.max(1, store.speed)
      ) {
        prev = state
        const { autopilot, input } = useGame.getState()
        state = tick(state, TICK_SECONDS, autopilot ? autopilot(state) : input)
        events.push(...state.events)
        accumulator -= TICK_SECONDS
        steps++
      }
      if (steps > 0) {
        if (accumulator > TICK_SECONDS) accumulator = 0
        useGame.setState({ state, prev, tickedAt: now })
        emitGameEvents(events)
      }
    }
    frame = requestAnimationFrame(loop)
  }
  frame = requestAnimationFrame(loop)
  return () => {
    running = false
    cancelAnimationFrame(frame)
  }
}
