// Connects game events to the Analytics interface: playtest tracking (Phase 4B) and the full
// measurement plan (Phase 7). Every event carries install date, days since install, app version
// and the tester name from a ?tester=NAME link.
import { getContent } from '../game/content.ts'
import type { GameEvent } from '../game/types.ts'
import { platform } from '../platform/index.ts'
import { onGameEvent } from './events.ts'
import { useGame } from './gameStore.ts'

const TESTER_KEY = 'solar-oasis.tester'
const INSTALL_KEY = 'solar-oasis.installedAt'
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0'

function stored(key: string, make: () => string): string {
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const value = make()
    localStorage.setItem(key, value)
    return value
  } catch {
    return make()
  }
}

export function testerId(): string {
  return stored(TESTER_KEY, () => crypto.randomUUID())
}

export function installedAt(): number {
  return Number(stored(INSTALL_KEY, () => String(Date.now())))
}

let sessionStart = performance.now()

export const minutesSinceSessionStart = () => (performance.now() - sessionStart) / 60000

/** Starts tracking; returns a function that stops it. */
export function startTracking(): () => void {
  const analytics = platform.analytics
  const params = new URLSearchParams(window.location.search)
  const tester = params.get('tester')
  const installed = installedAt()
  const daysSinceInstall = () => Math.floor((Date.now() - installed) / 86_400_000)
  void analytics.init()
  analytics.identify(testerId(), tester ? { tester } : undefined)
  analytics.register({
    install_date: new Date(installed).toISOString().slice(0, 10),
    app_version: APP_VERSION,
    tester: tester ?? null,
  })
  const track = (event: string, props: Record<string, string | number | boolean | null> = {}) =>
    analytics.track(event, { ...props, days_since_install: daysSinceInstall() })

  sessionStart = performance.now()
  track('app_open')
  track('session_start')

  const content = () => getContent(useGame.getState().state.mapId)
  const minutesSinceInstall = () => Math.round((Date.now() - installed) / 6000) / 10
  const off = onGameEvent((e: GameEvent) => {
    switch (e.type) {
      case 'padBuilt': {
        const pad = content().map.pads.find((p) => p.id === e.padId)
        track('pad_built', {
          id: e.padId,
          kind: e.kind,
          cost: pad?.price ?? 0,
          seconds_since_session_start: Math.round((performance.now() - sessionStart) / 1000),
          minutes_since_install: minutesSinceInstall(),
        })
        if (e.kind === 'technician' || e.kind === 'cashier' || e.kind === 'robot')
          track('staff_hired', { kind: e.kind, id: e.padId })
        break
      }
      case 'carLost':
        track('car_lost', { blackout: useGame.getState().state.energy.blackout })
        break
      case 'dayStarted':
        track('night_survived', { survived: e.survived, day: e.day })
        // The game opens on day 0, so the first sunrise after a night is day 1.
        if (e.day === 1) track('first_night_survived', { survived: e.survived })
        break
      case 'eventStarted':
        track('event_started', { kind: e.kind })
        break
      case 'mapComplete':
        track('map_complete', {
          map: useGame.getState().state.mapId,
          minutes_since_install: minutesSinceInstall(),
        })
        break
    }
  })

  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    track('session_end', { minutes: Math.round(minutesSinceSessionStart() * 10) / 10 })
    analytics.flush()
  }
  const visibility = () => {
    if (document.visibilityState === 'hidden') end()
    else if (ended) {
      ended = false
      sessionStart = performance.now()
      track('session_start')
    }
  }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', end)
  return () => {
    off()
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', end)
  }
}

/** Analytics helpers for UI code (tutorial, ads, purchases, offline card). */
export function trackUi(
  event: string,
  props: Record<string, string | number | boolean | null> = {},
) {
  platform.analytics.track(event, props)
}
