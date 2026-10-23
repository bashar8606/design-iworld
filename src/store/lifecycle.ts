// Pure helpers for saving and resuming, kept separate from the platform so they can be tested.
import { simulateOffline, awaySeconds } from '../game/offline.ts'
import { deserializeSave, nextSavedAt, serializeSave } from '../game/save.ts'
import { getContent } from '../game/content.ts'
import type { GameState } from '../game/types.ts'

export interface ResumeResult {
  state: GameState
  /** Cash earned while away (already added), or 0. */
  earned: number
  awaySeconds: number
  savedAt: number
}

/** Loads a save and fast-forwards it to `nowMs`; null when there is no usable save. */
export function resumeFromSave(json: string | null, nowMs: number): ResumeResult | null {
  const save = deserializeSave(json)
  if (!save) return null
  return catchUp(save.state, save.savedAt, nowMs)
}

/** Applies offline progress since `savedAt`. Clock moved back: nothing; forward: capped. */
export function catchUp(state: GameState, savedAt: number, nowMs: number): ResumeResult {
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

export function saveJson(
  state: GameState,
  previousSavedAt: number | null,
  nowMs: number,
): { json: string; savedAt: number } {
  const savedAt = nextSavedAt(previousSavedAt, nowMs)
  return { json: serializeSave(state, savedAt), savedAt }
}
