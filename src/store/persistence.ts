// Saves the game through the Storage interface and handles going to the background and back.
import { getContent } from '../game/content.ts'
import { SAVE_KEY } from '../game/save.ts'
import { platform } from '../platform/index.ts'
import { onGameEvent } from './events.ts'
import { onAction, useGame } from './gameStore.ts'
import { catchUp, resumeFromSave, saveJson } from './lifecycle.ts'
import { trackUi } from './tracking.ts'
import { useUi } from './uiStore.ts'

let savedAt: number | null = null
let saving = Promise.resolve()

/** Saves now; saves are queued so two never interleave. */
export function saveNow(): Promise<void> {
  saving = saving.then(async () => {
    const { json, savedAt: at } = saveJson(useGame.getState().state, savedAt, Date.now())
    savedAt = at
    await platform.storage.set(SAVE_KEY, json)
  })
  return saving
}

export async function resetSave(): Promise<void> {
  await platform.storage.remove(SAVE_KEY)
  savedAt = null
}

function showAwayCard(earned: number, seconds: number) {
  const { minSecondsForCard } = getContent(useGame.getState().state.mapId).economy.offline
  if (seconds >= minSecondsForCard && earned > 0) {
    useUi.getState().showOffline(earned, seconds)
    trackUi('offline_card_shown', { earned: Math.round(earned), minutes: Math.round(seconds / 60) })
  }
}

/** Loads the save (with offline earnings), then keeps it up to date. Returns a cleanup. */
export function startPersistence(options: { skipLoad?: boolean } = {}): () => void {
  const game = useGame.getState()
  void (async () => {
    if (!options.skipLoad) {
      const resumed = resumeFromSave(await platform.storage.get(SAVE_KEY), Date.now())
      if (resumed) {
        savedAt = resumed.savedAt
        game.replace(resumed.state)
        showAwayCard(resumed.earned, resumed.awaySeconds)
      }
    }
    useUi.getState().setLoaded()
  })()

  // Save after every purchase.
  const offEvents = onGameEvent((e) => {
    if (e.type === 'padBuilt' || e.type === 'upgradeDone' || e.type === 'mapComplete')
      void saveNow()
  })

  const offActions = onAction((action) => {
    if (action.type !== 'debugAddCash') void saveNow()
  })

  // And every few seconds while playing.
  const interval = setInterval(
    () => {
      if (!useGame.getState().paused && useUi.getState().loaded) void saveNow()
    },
    getContent(game.state.mapId).economy.save.autosaveSeconds * 1000,
  )

  // Background: save, pause rendering and sound. Foreground: catch up and resume.
  let backgrounded = false
  const offLifecycle = platform.lifecycle.onActiveChange((active) => {
    if (!active && !backgrounded) {
      backgrounded = true
      useGame.getState().setPaused(true)
      void saveNow()
    } else if (active && backgrounded) {
      backgrounded = false
      const { state } = useGame.getState()
      const resumed = catchUp(state, savedAt ?? Date.now(), Date.now())
      savedAt = resumed.savedAt
      if (resumed.awaySeconds > 0) {
        useGame.getState().replace(resumed.state)
        showAwayCard(resumed.earned, resumed.awaySeconds)
      }
      useGame.getState().setPaused(false)
    }
  })

  return () => {
    offEvents()
    offActions()
    offLifecycle()
    clearInterval(interval)
  }
}
