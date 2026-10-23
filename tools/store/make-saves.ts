// Builds the five App Store save states by playing the real game with the autopilot.
//   npm run store:saves
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applyAction } from '../../src/game/actions.ts'
import { Bot } from '../../src/game/autopilot.ts'
import { getContent } from '../../src/game/content.ts'
import { serializeSave } from '../../src/game/save.ts'
import { buildPadItem, createInitialState } from '../../src/game/state.ts'
import { NO_INPUT, tick } from '../../src/game/tick.ts'
import type { GameState } from '../../src/game/types.ts'

const content = getContent('map1')
const outDir = resolve(import.meta.dirname, 'saves')
const TICK = 0.1

export const STORE_SAVES = [
  'first_minute',
  'evening_rush',
  'night_station',
  'sandstorm',
  'map_complete',
] as const
export type StoreSave = (typeof STORE_SAVES)[number]

function play(
  state: GameState,
  seconds: number,
  bot = new Bot({ strategy: 'greedy', activeShare: 1 }),
) {
  let s = state
  for (let t = 0; t < seconds; t += TICK) {
    const { input, actions } = bot.decide(s, content)
    for (const a of actions) s = applyAction(s, a, content)
    s = tick(s, TICK, input, {}, content)
  }
  return s
}

/** Plays on until the clock reaches `dayTime` (0..1). */
function playUntil(state: GameState, dayTime: number, bot?: Bot) {
  let s = state
  const bot2 = bot ?? new Bot({ strategy: 'greedy', activeShare: 1 })
  for (let i = 0; i < 20000 && Math.abs(s.dayTime - dayTime) > 0.004; i++) s = play(s, TICK, bot2)
  return s
}

/** Brings in a burst of cars and lets them queue (the player stands back, so they wait). */
function crowd(state: GameState, cars: number, seconds = 9): GameState {
  let s = state
  for (let i = 0; i < cars; i++) {
    s = tick({ ...s, nextArrivalAt: s.time }, TICK, NO_INPUT, {}, content)
    for (let k = 0; k < 6; k++) s = tick(s, TICK, NO_INPUT, {}, content)
  }
  for (let t = 0; t < seconds; t += TICK) s = tick(s, TICK, NO_INPUT, {}, content)
  return s
}

function buildAll(state: GameState): GameState {
  const s = structuredClone(state)
  for (const pad of content.map.pads) if (!s.pads[pad.id]?.built) buildPadItem(s, pad, content)
  return s
}

function at(s: GameState, x: number, z: number): GameState {
  return { ...s, player: { ...s.player, pos: { x, z }, plug: null } }
}

const saves: Record<StoreSave, () => GameState> = {
  first_minute: () => at(play(createInitialState('map1', { seed: 11 }), 50), -0.4, 0.4),
  evening_rush: () => {
    // A few game days in: four chargers, a battery and a technician, at the evening peak.
    let s = createInitialState('map1', { seed: 12 })
    s = play(s, 14 * 60)
    s = playUntil(s, content.map.arrivals.rushTime - 0.075)
    return crowd(at(s, 0.2, 3), 9)
  },
  night_station: () => {
    let s = buildAll(createInitialState('map1', { seed: 13 }))
    s = { ...s, cash: 48_250 }
    s = playUntil(s, 0.9)
    s.energy.stored = s.energy.capacity * 0.7
    return crowd(at(play(s, 10), 0, 4), 10, 6)
  },
  sandstorm: () => {
    let s = createInitialState('map1', { seed: 14 })
    s = play(s, 10 * 60)
    s = playUntil(s, 0.45)
    s = {
      ...s,
      event: {
        kind: 'sandstorm',
        announceAt: s.time - 40,
        startsAt: s.time - 10,
        endsAt: s.time + 60,
      },
    }
    s = play(s, 6)
    return crowd(at(s, 5.5, -6.5), 4, 4)
  },
  map_complete: () => {
    let s = buildAll(createInitialState('map1', { seed: 15 }))
    s = { ...s, cash: 1_250_000, stats: { ...s.stats, totalEarned: 2_400_000, carsServed: 9_870 } }
    s = playUntil(s, 0.5)
    return crowd(at(play(s, 30), 2.5, 2), 5, 5)
  },
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(outDir, { recursive: true })
  for (const name of STORE_SAVES) {
    const state = saves[name]()
    writeFileSync(join(outDir, `${name}.json`), serializeSave(state, 0))
    console.log(
      `${name.padEnd(14)} day ${state.day} ${state.dayTime.toFixed(2)}  cars ${state.cars.length}  pads ${Object.values(state.pads).filter((p) => p.built).length}  cash ${Math.round(state.cash)}`,
    )
  }
}
