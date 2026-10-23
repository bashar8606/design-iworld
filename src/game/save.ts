import { emptyCollection } from './collection.ts'
import { getContent } from './content.ts'
import { initialMissions } from './missions.ts'
import { SAVE_VERSION } from './state.ts'
import type { GameState } from './types.ts'

export interface SaveFile {
  version: number
  /** Wall-clock ms of the save, never moved backwards (see `nextSavedAt`). */
  savedAt: number
  state: GameState
}

export const SAVE_KEY = 'solar-oasis.save'

/** The save time only moves forward, so setting the clock back and forth earns nothing extra. */
export function nextSavedAt(previous: number | null, nowMs: number): number {
  return Math.max(previous ?? 0, nowMs)
}

export function serializeSave(state: GameState, savedAt: number): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt, state: { ...state, events: [] } }
  return JSON.stringify(file)
}

type Migration = (state: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] upgrades a version-n save to version n + 1. */
const migrations: Record<number, Migration> = {}

export function migrate(raw: {
  version: number
  state: Record<string, unknown>
}): Record<string, unknown> {
  let { version, state } = raw
  while (version < SAVE_VERSION) {
    const step = migrations[version]
    if (!step) throw new Error(`No migration from save version ${version}`)
    state = step(state)
    version += 1
  }
  return { ...state, version }
}

/** Parses a save; returns null when it is missing, corrupt or from a newer app version. */
export function deserializeSave(json: string | null): SaveFile | null {
  if (!json) return null
  try {
    const raw = JSON.parse(json) as { version?: unknown; savedAt?: unknown; state?: unknown }
    if (typeof raw.version !== 'number' || typeof raw.savedAt !== 'number') return null
    if (typeof raw.state !== 'object' || raw.state === null) return null
    if (raw.version > SAVE_VERSION) return null
    const state = migrate({ version: raw.version, state: raw.state as Record<string, unknown> })
    if (typeof state.mapId !== 'string' || typeof state.time !== 'number') return null
    // Saves from before the purchase ledger existed.
    if (!('ledger' in state)) state.ledger = null
    // Saves from before missions existed get a fresh set.
    if (!('missions' in state)) state.missions = initialMissions(state as unknown as GameState)
    // Saves from before the car album, and cars on the road from before golden cars.
    if (!('collection' in state)) state.collection = emptyCollection()
    if (!('turbines' in state)) state.turbines = []
    for (const car of (state.cars as { golden?: boolean }[] | undefined) ?? []) car.golden ??= false
    grantBuiltZones(state as unknown as GameState)
    return { version: SAVE_VERSION, savedAt: raw.savedAt, state: state as unknown as GameState }
  } catch {
    return null
  }
}

/**
 * Saves from before a map was split into zones may already have built things in a zone they
 * never bought; they get that land for free so nothing they own is fenced off.
 */
function grantBuiltZones(state: GameState) {
  const { map } = getContent(state.mapId)
  for (const land of map.pads.filter((p) => p.opensZone)) {
    const built = map.pads.some((p) => p.zone === land.opensZone && state.pads[p.id]?.built)
    if (built) state.pads[land.id] = { paid: land.price, built: true, builtAt: 0 }
    else state.pads[land.id] ??= { paid: 0, built: false, builtAt: null }
  }
}
