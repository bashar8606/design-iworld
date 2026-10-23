import { getContent } from '../game/content.ts'
import { useAds, watchRewarded } from '../store/ads.ts'
import { useGame } from '../store/gameStore.ts'
import { useShop } from '../store/shop.ts'
import { useTutorial } from '../store/tutorial.ts'
import { useUi } from '../store/uiStore.ts'
import { formatDuration } from './format.ts'
import { useClaimableMissions } from './missionText.ts'
import { upgradeOptions } from './upgrades.ts'

export function NavButton({
  tone,
  icon,
  label,
  badge,
  disabled,
  onClick,
}: {
  tone: 'gold' | 'blue' | 'purple' | 'white'
  icon: React.ReactNode
  label: string
  badge?: number | string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`nav-button nav-${tone}`}
      data-hud-control
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
    >
      <span className="nav-tile">
        <span className="nav-icon" aria-hidden>
          {icon}
        </span>
        {badge !== undefined && badge !== 0 && <span className="nav-badge">{badge}</span>}
      </span>
      <span className="nav-label">{label}</span>
    </button>
  )
}

/** Solar Boost: 2x income for 10 minutes, stackable to 4 hours, for a rewarded ad. */
function BoostButton() {
  const ready = useAds((s) => s.ready === 'solar_boost' && !s.showing)
  const left = useGame((s) => Math.max(0, Math.ceil(s.state.boosts.adIncomeUntil - s.state.time)))
  const tutorial = useTutorial((s) => s.active)
  return (
    <NavButton
      tone="gold"
      icon={<span className="nav-boost">2x</span>}
      label={left > 0 ? formatDuration(left) : 'Boost'}
      disabled={tutorial || !ready}
      onClick={() => void watchRewarded('solar_boost')}
    />
  )
}

/** Upgrades the player can afford right now (the Build badge). */
function useAffordableUpgrades(): number {
  return useGame((s) => {
    const { cash } = s.state
    return upgradeOptions(s.state, getContent(s.state.mapId)).filter(
      (o) => o.to && o.upgradingUntil === 0 && o.price !== null && cash >= o.price,
    ).length
  })
}

/** Boost, Shop, Missions, Map and Build along the bottom of the screen. */
export function BottomNav({ store = false }: { store?: boolean }) {
  const open = useUi((s) => s.open)
  const starterOwned = useShop((s) => s.starterOwned)
  const claimable = useClaimableMissions()
  const affordable = useAffordableUpgrades()
  return (
    <nav className="bottom-nav" aria-label="Menu">
      {!store && <BoostButton />}
      <NavButton
        tone="blue"
        icon="🛒"
        label="Shop"
        badge={store || starterOwned ? undefined : '!'}
        onClick={() => open('shop')}
      />
      <NavButton
        tone="purple"
        icon="📋"
        label="Missions"
        badge={claimable}
        onClick={() => open('missions')}
      />
      <NavButton tone="white" icon="🗺️" label="Map" onClick={() => open('map')} />
      <NavButton
        tone="white"
        icon="🔨"
        label="Build"
        badge={affordable}
        onClick={() => open('upgrades')}
      />
    </nav>
  )
}
