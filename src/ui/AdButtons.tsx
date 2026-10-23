import { longestUpgrade } from '../game/actions.ts'
import type { AdPlacement } from '../platform/ads.ts'
import { useAds, watchRewarded } from '../store/ads.ts'
import { useGame } from '../store/gameStore.ts'
import { formatDuration } from './format.ts'

const LABELS: Record<Exclude<AdPlacement, 'solar_boost' | 'welcome_back'>, string> = {
  vip_car: '🚘 VIP car pays 5x',
  blackout_rescue: '🔋 Refill batteries',
  instant_build: '⏩ Finish upgrade',
  daily_chest: '🎁 Daily chest',
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
