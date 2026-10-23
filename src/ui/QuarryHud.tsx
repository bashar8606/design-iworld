import { useState } from 'react'
import { getQuarryContent } from '../game/quarry/content.ts'
import { quarryHint } from '../game/quarry/hint.ts'
import { backpackCapacity } from '../game/quarry/state.ts'
import { isNight } from '../game/world.ts'
import { goToBusiness } from '../store/businessSwitch.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { NavButton } from './BottomNav.tsx'
import { useFiveTaps } from './useFiveTaps.ts'
import { clockTime, formatCash } from './format.ts'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function QuarryTimePill({ onTap }: { onTap: () => void }) {
  const dayTime = useGame((s) => Math.floor((s.quarry?.dayTime ?? 0) * 144) / 144)
  const day = useGame((s) => s.quarry?.day ?? 0)
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const night = isNight(dayTime, getQuarryContent(quarryId).quarry)
  return (
    <button
      className="top-time"
      data-hud-control
      onClick={onTap}
      aria-label={`Day ${day + 1}, ${clockTime(dayTime)}`}
    >
      <span className={`top-time-icon${night ? ' is-night' : ''}`} aria-hidden>
        {night ? '🌙' : '☀️'}
      </span>
      <span className="top-time-text">
        <strong>Day {day + 1}</strong>
        <small>
          {WEEKDAYS[day % 7]} {clockTime(dayTime)}
        </small>
      </span>
    </button>
  )
}

function QuarryCash() {
  const cash = useGame((s) => Math.floor(s.quarry?.cash ?? 0))
  return (
    <div className="top-cash quarry-cash" aria-label="Quarry cash">
      <span className="top-cash-icon" aria-hidden>
        💵
      </span>
      <strong>{formatCash(cash)}</strong>
    </div>
  )
}

/** Rosa's welcome, until the first cash is collected or the player closes it. */
function SiteCard() {
  const [open, setOpen] = useState(true)
  const earned = useGame((s) => (s.quarry?.stats.totalEarned ?? 0) > 0)
  if (!open || earned) return null
  return (
    <div className="quarry-card" role="status">
      <span className="quarry-avatar" aria-hidden>
        R
      </span>
      <div className="quarry-card-text">
        <small>Rosa · site manager</small>
        <strong>Welcome to Pine Ridge!</strong>
        <p>Mine rock, tip it into the crusher, and the pickups buy the gravel.</p>
      </div>
      <button
        className="quarry-card-close"
        data-hud-control
        aria-label="Hide"
        onClick={() => setOpen(false)}
      >
        ×
      </button>
    </div>
  )
}

/** Backpack, hopper and pile at a glance. */
function SiteStatus() {
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const { quarry } = getQuarryContent(quarryId)
  const pile = quarry.stockpiles[0]!
  const carry = useGame((s) => s.quarry?.player.carry ?? 0)
  const cap = useGame((s) => (s.quarry ? backpackCapacity(s.quarry, quarry) : 0))
  const hopper = useGame((s) => Math.round((s.quarry?.hopper ?? 0) * 4) / 4)
  const gravel = useGame((s) => Math.floor(s.quarry?.piles[pile.id] ?? 0))
  return (
    <div className="quarry-status" aria-label="Site status">
      <span title="Rock in your backpack">
        🎒 {carry}/{cap}
      </span>
      <span title="Rock in the crusher hopper">
        ⚙️ {hopper}/{quarry.crusher.hopperTons} t
      </span>
      <span title="Gravel on the pile">
        ⛰️ {gravel}/{pile.capacityTons} t
      </span>
    </div>
  )
}

function Hint() {
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const { quarry } = getQuarryContent(quarryId)
  const text = useGame((s) =>
    s.quarry && s.quarry.stats.totalEarned < 150 ? quarryHint(s.quarry, quarry).text : null,
  )
  if (!text) return null
  return <div className="tutorial-hint quarry-hint">👉 {text}</div>
}

/** The quarry's HUD: clock, site name, the way back to the station and the map. */
export function QuarryHud({ allowDebug = true }: { allowDebug?: boolean }) {
  const open = useUi((s) => s.open)
  const onClockTap = useFiveTaps(() => allowDebug && open('debug'))
  const quarryId = useGame((s) => s.quarry?.quarryId ?? 'quarry1')
  const { name } = getQuarryContent(quarryId).quarry
  return (
    <div className="hud">
      <div className="top-bar">
        <QuarryTimePill onTap={onClockTap} />
        <div className="quarry-name">
          <span aria-hidden>⛏</span> {name}
        </div>
        <QuarryCash />
      </div>
      <div className="hud-under-bar">
        <SiteStatus />
        <Hint />
      </div>
      <div className="hud-bottom">
        <SiteCard />
        <nav className="bottom-nav" aria-label="Menu">
          <NavButton tone="white" icon="🗺️" label="Map" onClick={() => open('map')} />
          <NavButton
            tone="gold"
            icon="⚡"
            label="Station"
            onClick={() => goToBusiness('station')}
          />
        </nav>
      </div>
    </div>
  )
}
