// App Store capture mode: load one of the store saves (tools/store/saves), hide debug UI and
// prompts, and optionally let the autopilot play for the preview video.
//   Browser:   ?store=evening_rush   ?store=demo
//   Simulator: xcrun simctl openurl booted solaroasis://store/evening_rush
import { create } from 'zustand'
import { Bot } from '../game/autopilot.ts'
import { getContent } from '../game/content.ts'
import { deserializeSave } from '../game/save.ts'
import { platform } from '../platform/index.ts'
import { useGame } from './gameStore.ts'

// Store saves ship only in development and store builds (VITE_STORE=1).
const saveFiles: Record<string, () => Promise<string>> =
  import.meta.env.DEV || import.meta.env.VITE_STORE === '1'
    ? import.meta.glob<string>('../../tools/store/saves/*.json', {
        query: '?raw',
        import: 'default',
      })
    : {}

export const useStoreMode = create<{ active: boolean; name: string | null }>()(() => ({
  active: false,
  name: null,
}))

function parse(url: string): string | null {
  const query = /[?&]store=([\w-]+)/.exec(url)
  if (query) return query[1]!
  const link = /solaroasis:\/\/store\/([\w-]+)/.exec(url)
  return link ? link[1]! : null
}

/** Enabled before the app renders when the page was opened with ?store=. */
export function initialStoreMode(): boolean {
  const name = parse(window.location.href)
  if (name) useStoreMode.setState({ active: true, name })
  return !!name
}

async function enter(name: string) {
  useStoreMode.setState({ active: true, name })
  const demo = name === 'demo'
  const file = saveFiles[`../../tools/store/saves/${demo ? 'evening_rush' : name}.json`]
  if (!file) {
    console.warn(`[store] no save "${name}"; run npm run store:saves and use a store build`)
    return
  }
  const save = deserializeSave(await file())
  if (!save) return
  const game = useGame.getState()
  game.replace(save.state)
  if (demo) {
    const bot = new Bot({ strategy: 'greedy', activeShare: 1 })
    game.setAutopilot((s) => {
      const { input, actions } = bot.decide(s, getContent(s.mapId))
      for (const action of actions) useGame.getState().dispatch(action)
      return input
    })
  } else {
    game.setAutopilot(null)
  }
}

/** Starts store mode from the URL or a deep link; returns a cleanup. */
export function startStoreMode(): () => void {
  const name = parse(window.location.href)
  if (name) void enter(name)
  return platform.lifecycle.onUrlOpen((url) => {
    const linked = parse(url)
    if (linked) void enter(linked)
  })
}
