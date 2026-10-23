// Rewarded and interstitial ads: which placement to offer and preload, showing ads with the game
// paused, granting rewards, the interstitial rules and analytics for every ad event.
import { create } from 'zustand'
import { longestUpgrade } from '../game/actions.ts'
import adsConfig from '../content/ads.json'
import type { GameState } from '../game/types.ts'
import { activeEvent } from '../game/world.ts'
import type { AdPlacement } from '../platform/ads.ts'
import { platform } from '../platform/index.ts'
import { onGameEvent } from './events.ts'
import { useGame } from './gameStore.ts'
import { useShop } from './shop.ts'
import { trackUi } from './tracking.ts'
import { useTutorial } from './tutorial.ts'
import { useUi } from './uiStore.ts'

const PLAY_KEY = 'solar-oasis.playSeconds'
const SESSIONS_KEY = 'solar-oasis.sessions'
const CHEST_KEY = 'solar-oasis.dailyChest'
const rules = adsConfig.rules

function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0
  } catch {
    return 0
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // ignore
  }
}

const today = () => new Date().toISOString().slice(0, 10)

function chestAvailable(): boolean {
  try {
    return localStorage.getItem(CHEST_KEY) !== today()
  } catch {
    return false
  }
}

export interface AdsState {
  /** The placement whose ad is loaded (its button can show). */
  ready: AdPlacement | null
  /** Placements the game wants to offer right now, most important first. */
  offered: AdPlacement[]
  showing: boolean
}

export const useAds = create<AdsState>()(() => ({
  ready: null,
  offered: ['solar_boost'],
  showing: false,
}))

/** Which rewarded placements make sense right now. */
export function offeredPlacements(state: GameState, awaySeconds: number | null): AdPlacement[] {
  const out: AdPlacement[] = []
  if (awaySeconds !== null && awaySeconds >= rules.welcomeBackMinAwaySeconds)
    out.push('welcome_back')
  const storm = activeEvent(state)?.kind === 'sandstorm'
  if (
    (state.energy.blackout || storm) &&
    state.energy.capacity > 0 &&
    state.energy.stored < state.energy.capacity * 0.5
  ) {
    out.push('blackout_rescue')
  }
  if (state.vipOfferUntil > state.time) out.push('vip_car')
  if ((longestUpgrade(state)?.seconds ?? 0) > rules.instantBuildMinSeconds)
    out.push('instant_build')
  if (chestAvailable() && state.milestones.firstCashAt !== null) out.push('daily_chest')
  out.push('solar_boost')
  return out
}

/** Shows a rewarded ad with the game paused and grants its reward. */
export async function watchRewarded(placement: AdPlacement, amount = 0): Promise<boolean> {
  const game = useGame.getState()
  useAds.setState({ showing: true, ready: null })
  game.setPaused(true)
  let earned: boolean
  try {
    earned = await platform.ads.showRewarded(placement)
  } finally {
    useGame.getState().setPaused(false)
    useAds.setState({ showing: false })
  }
  if (!earned) return false
  if (placement === 'daily_chest') {
    const { state } = useGame.getState()
    const perMinute = state.time > 60 ? (state.stats.totalEarned / state.time) * 60 : 20
    useGame.getState().dispatch({
      type: 'reward',
      placement,
      amount: Math.round(perMinute * adsConfig.dailyChest.cashMinutes),
    })
    try {
      localStorage.setItem(CHEST_KEY, today())
    } catch {
      // ignore
    }
  } else {
    useGame.getState().dispatch({ type: 'reward', placement, amount })
  }
  return true
}

let lastInterstitial = 0

/** Interstitials only at natural breaks, rationed, never early or for players without ads. */
export async function maybeInterstitial(reason: string) {
  const now = performance.now()
  if (useShop.getState().noAds) return
  if (useTutorial.getState().active) return
  if (readNumber(PLAY_KEY) < rules.noInterstitialFirstSeconds) return
  if (lastInterstitial && now - lastInterstitial < rules.interstitialMinGapSeconds * 1000) return
  if (!platform.ads.interstitialReady() || useAds.getState().showing) {
    void platform.ads.prepareInterstitial()
    return
  }
  lastInterstitial = now
  useAds.setState({ showing: true })
  useGame.getState().setPaused(true)
  try {
    if (await platform.ads.showInterstitial()) trackUi('interstitial_shown', { reason })
  } finally {
    useGame.getState().setPaused(false)
    useAds.setState({ showing: false })
    void platform.ads.prepareInterstitial()
  }
}

/** Starts the ads system after the save has loaded; returns a cleanup. */
export function startAds(): () => void {
  const sessions = readNumber(SESSIONS_KEY) + 1
  writeNumber(SESSIONS_KEY, sessions)
  const testing = import.meta.env.DEV || import.meta.env.VITE_ADS_TEST === '1'
  const ads = platform.ads
  let started = false
  const offEvents = ads.onEvent((event, placement) => {
    trackUi(`ad_${event}`, { placement })
    if (placement !== 'interstitial') {
      if (event === 'loaded') useAds.setState({ ready: ads.readyPlacement() })
      if (event === 'shown') trackUi('ad_offer_shown', { placement })
      if (event === 'rewarded') trackUi('ad_rewarded', { placement })
    }
  })
  void ads
    .init({ allowTrackingPrompt: sessions >= 2, testing })
    .then(() => {
      started = true
      void ads.prepareInterstitial()
    })
    .catch((e) => console.warn('[ads] init', e))

  // Every second: decide what to offer and keep the most important placement loaded.
  const timer = setInterval(() => {
    if (!started) return
    const { state, paused } = useGame.getState()
    if (!paused) writeNumber(PLAY_KEY, readNumber(PLAY_KEY) + 1)
    const offline = useUi.getState().offline
    const offered = offeredPlacements(state, offline?.seconds ?? null)
    useAds.setState({ offered, ready: ads.readyPlacement() })
    const wanted = offered[0]!
    if (!useAds.getState().showing && ads.readyPlacement() !== wanted)
      void ads.prepareRewarded(wanted)
  }, 1000)

  // Natural breaks for interstitials: milestone builds and the map-complete screen.
  const offGame = onGameEvent((e) => {
    if (e.type === 'padBuilt' && rules.milestonePads.includes(e.padId))
      void maybeInterstitial(`milestone:${e.padId}`)
    if (e.type === 'mapComplete') void maybeInterstitial('map_complete')
  })

  return () => {
    offEvents()
    offGame()
    clearInterval(timer)
  }
}
