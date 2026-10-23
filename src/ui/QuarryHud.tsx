import { useState } from 'react'
import { getQuarryContent } from '../game/quarry/content.ts'
import { isNight } from '../game/world.ts'
import { goToBusiness } from '../store/businessSwitch.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { NavButton } from './BottomNav.tsx'
import { useFiveTaps } from './useFiveTaps.ts'
import { clockTime } from './format.ts'

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

/** Rosa's welcome on the empty site, until digging arrives. */
function SiteCard() {
  const [open, setOpen] = useState(true)
  if (!open)
    return (
      <button className="quarry-chip" data-hud-control onClick={() => setOpen(true)}>
        ⛏ Site survey
      </button>
    )
  return (
    <div className="quarry-card" role="status">
      <span className="quarry-avatar" aria-hidden>
        R
      </span>
      <div className="quarry-card-text">
        <small>Rosa · site manager</small>
        <strong>Welcome to Pine Ridge!</strong>
        <p>
          The pit is pegged out and the office is in. Digging starts soon: pickaxe, crusher, dump
          trucks and the first buyers.
        </p>
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
        <button
          className="top-cash quarry-back"
          data-hud-control
          onClick={() => goToBusiness('station')}
        >
          <span aria-hidden>⚡</span> Station
        </button>
      </div>
      <div className="hud-under-bar">
        <SiteCard />
      </div>
      <div className="hud-bottom">
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
