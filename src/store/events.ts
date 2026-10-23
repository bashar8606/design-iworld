import type { GameEvent } from '../game/types.ts'

type Listener = (event: GameEvent) => void
const listeners = new Set<Listener>()

/** Game events fan out to sound, haptics, effects and analytics. */
export function onGameEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitGameEvents(events: GameEvent[]): void {
  for (const event of events) for (const listener of listeners) listener(event)
}
