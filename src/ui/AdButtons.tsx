import { longestUpgrade } from '../game/actions.ts'
import type { AdPlacement } from '../platform/ads.ts'
import { useAds, watchRewarded } from '../store/ads.ts'
import { useGame } from '../store/gameStore.ts'
import { useTutorial } from '../store/tutorial.ts'
import { formatDuration } from './format.ts'

const LABELS: Record<Exclude<AdPlacement, 'solar_boost' | 'welcome_back'>, string> = {
  vip_car: '🚘 VIP car pays 5x',
  blackout_rescue: '🔋 Refill batteries',
  instant_build: '⏩ Finish upgrade',
  daily_chest: '🎁 Daily chest',
}

/** Solar Boost: 2x income for 10 minutes, stackable to 4 hours. Shown only when an ad is loaded. */
export function SolarBoostButton() {
  const ready = useAds((s) => s.ready === 'solar_boost' && !s.showing)
  const left = useGame((s) => Math.max(0, Math.ceil(s.state.boosts.adIncomeUntil - s.state.time)))
  const tutorial = useTutorial((s) => s.active)
  if (tutorial || (!ready && left === 0)) return null
  return (
    <button
      className={`boost-button${left > 0 ? ' boost-active' : ''}`}
      data-hud-control
      disabled={!ready}
      onClick={() => void watchRewarded('solar_boost')}
      aria-label="Solar Boost: watch an ad for double income"
    >
      <span className="boost-icon">☀️ 2x</span>
      <span className="boost-label">{left > 0 ? formatDuration(left) : '▶ Boost'}</span>
    </button>
  )
}

/** One contextual offer at a time (VIP car, blackout rescue, instant build, daily chest). */
export function AdOffer() {
  const ready = useAds((s) => (s.showing ? null : s.ready))
  const offered = useAds((s) => s.offered)
  const upgradeLeft = useGame((s) => Math.ceil(longestUpgrade(s.state)?.seconds ?? 0))
  if (!ready || ready === 'solar_boost' || ready === 'welcome_back' || !offered.includes(ready))
    return null
  return (
    <button className="ad-offer" data-hud-control onClick={() => void watchRewarded(ready)}>
      <span>{LABELS[ready]}</span>
      {ready === 'instant_build' && <small>{formatDuration(upgradeLeft)} left</small>}
      <span className="ad-offer-play">▶</span>
    </button>
  )
}
