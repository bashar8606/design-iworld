// Pure helpers for saving and resuming, kept separate from the platform so they can be tested.
import { simulateOffline, awaySeconds } from '../game/offline.ts'
import { getQuarryContent } from '../game/quarry/content.ts'
import { simulateQuarryOffline } from '../game/quarry/tick.ts'
import type { QuarryState } from '../game/quarry/types.ts'
import { type SaveExtras, deserializeSave, nextSavedAt, serializeSave } from '../game/save.ts'
import { getContent } from '../game/content.ts'
import type { GameState } from '../game/types.ts'

export interface ResumeResult extends SaveExtras {
  state: GameState
  /** Cash earned while away (already added), or 0. */
  earned: number
  awaySeconds: number
  savedAt: number
}

/**
 * Loads a save and fast-forwards the business that was on screen to `nowMs`; the other one
 * stays frozen until the player switches to it. Null when there is no usable save.
 */
export function resumeFromSave(json: string | null, nowMs: number): ResumeResult | null {
  const save = deserializeSave(json)
  if (!save) return null
  const extras: SaveExtras = {
    business: save.business,
    quarry: save.quarry,
    inactiveSince: save.inactiveSince,
  }
  if (save.business === 'quarry' && save.quarry) {
    const quarry = catchUpQuarry(save.quarry, save.savedAt, nowMs)
    return { ...extras, ...quarry, quarry: quarry.state, state: save.state }
  }
  return { ...extras, ...catchUp(save.state, save.savedAt, nowMs) }
}

/** Applies offline progress since `savedAt`. Clock moved back: nothing; forward: capped. */
export function catchUp(
  state: GameState,
  savedAt: number,
  nowMs: number,
): Omit<ResumeResult, keyof SaveExtras> {
  const content = getContent(state.mapId)
  const away = awaySeconds(savedAt, nowMs, content)
  if (away < 1) return { state, earned: 0, awaySeconds: 0, savedAt: nextSavedAt(savedAt, nowMs) }
  const result = simulateOffline(state, away, content)
  return {
    state: result.state,
    earned: result.earned,
    awaySeconds: result.seconds,
    savedAt: nextSavedAt(savedAt, nowMs),
  }
}

/** The quarry's version of `catchUp`. */
export function catchUpQuarry(
  quarry: QuarryState,
  savedAt: number,
  nowMs: number,
): { state: QuarryState; earned: number; awaySeconds: number; savedAt: number } {
  const content = getQuarryContent(quarry.quarryId)
  const away = awaySeconds(savedAt, nowMs, content)
  const next = nextSavedAt(savedAt, nowMs)
  if (away < 1) return { state: quarry, earned: 0, awaySeconds: 0, savedAt: next }
  const result = simulateQuarryOffline(quarry, away, content)
  return { state: result.state, earned: result.earned, awaySeconds: result.seconds, savedAt: next }
}

export function saveJson(
  state: GameState,
  previousSavedAt: number | null,
  nowMs: number,
  extras: Partial<SaveExtras> = {},
): { json: string; savedAt: number } {
  const savedAt = nextSavedAt(previousSavedAt, nowMs)
  return { json: serializeSave(state, savedAt, extras), savedAt }
}
