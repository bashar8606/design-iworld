import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getContent } from '../game/content.ts'
import { useGame } from '../store/gameStore.ts'
import { STEPS, useTutorial } from '../store/tutorial.ts'
import { trackUi } from '../store/tracking.ts'
import { useUi } from '../store/uiStore.ts'
import { formatCash, formatDuration } from './format.ts'

/** "While you were away" with the offline earnings (already added to cash). */
export function OfflineCard({ onDouble }: { onDouble?: (earned: number) => void }) {
  const offline = useUi((s) => s.offline)
  const dismiss = useUi((s) => s.dismissOffline)
  if (!offline) return null
  return (
    <div className="card-backdrop" data-hud-control>
      <div className="card" role="dialog" aria-label="While you were away">
        <h2>While you were away</h2>
        <p>Your staff kept the station running for {formatDuration(offline.seconds)}.</p>
        <p className="card-amount">+{formatCash(offline.earned)}</p>
        <div className="card-actions">
          {onDouble && (
            <button
              className="btn btn-primary"
              onClick={() => {
                trackUi('offline_card_claimed', {
                  earned: Math.round(offline.earned),
                  doubled: true,
                })
                onDouble(offline.earned)
                dismiss()
              }}
            >
              ▶ Double it
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              trackUi('offline_card_claimed', {
                earned: Math.round(offline.earned),
                doubled: false,
              })
              dismiss()
            }}
          >
            Collect
          </button>
        </div>
      </div>
    </div>
  )
}

/** Banner 30 s before a sandstorm or heatwave, and while it lasts. */
export function EventBanner() {
  // useShallow: the selector builds a new object, so compare its fields, not its identity.
  const info = useGame(
    useShallow((s) => {
      const e = s.state.event
      if (!e) return { kind: null, phase: null, seconds: 0 }
      const t = s.state.time
      if (t < e.startsAt)
        return { kind: e.kind, phase: 'soon' as const, seconds: Math.ceil(e.startsAt - t) }
      if (t < e.endsAt)
        return { kind: e.kind, phase: 'now' as const, seconds: Math.ceil(e.endsAt - t) }
      return { kind: null, phase: null, seconds: 0 }
    }),
  )
  const snowy = useGame((s) => getContent(s.state.mapId).map.theme === 'snow')
  if (!info.kind) return null
  const soon = info.phase === 'soon'
  const snowLook = snowy ? SNOW_LOOKS[info.kind] : undefined
  const look = snowLook ?? EVENT_LOOKS[info.kind]
  const tone = snowLook ? snowLook.tone : info.kind
  return (
    <div className={`event-banner event-${tone}${soon ? ' is-soon' : ''}`} role="status">
      <span className="event-icon" aria-hidden>
        {look.icon}
      </span>
      <span className="event-text">
        <strong>{soon ? look.soon : look.title}</strong>
        <small>{look.effect}</small>
      </span>
      <span className="event-timer">
        {soon ? 'in ' : '⏱ '}
        {formatDuration(info.seconds)}
      </span>
    </div>
  )
}

const EVENT_LOOKS = {
  sandstorm: {
    icon: '🌪️',
    title: 'SANDSTORM!',
    soon: 'Sandstorm coming',
    effect: 'Panels at half power',
  },
  heatwave: { icon: '🔥', title: 'HEATWAVE!', soon: 'Heatwave coming', effect: 'Double the cars!' },
  nightRush: {
    icon: '🌙',
    title: 'NIGHT RUSH!',
    soon: 'Night rush coming',
    effect: 'Extra cars late',
  },
} as const

/** The same events on the ski lodge map: a blizzard buries the panels, a ski rush fills the lot. */
const SNOW_LOOKS: Partial<
  Record<
    keyof typeof EVENT_LOOKS,
    { icon: string; title: string; soon: string; effect: string; tone: string }
  >
> = {
  sandstorm: {
    icon: '❄️',
    title: 'BLIZZARD!',
    soon: 'Blizzard coming',
    effect: 'Panels snowed under',
    tone: 'blizzard',
  },
  heatwave: {
    icon: '⛷️',
    title: 'SKI RUSH!',
    soon: 'Ski rush coming',
    effect: 'Double the cars!',
    tone: 'skiRush',
  },
}

/** One-line tutorial hint at the top of the screen. */
export function TutorialHint() {
  const { step, active } = useTutorial()
  if (!active) return null
  const current = STEPS[step]
  if (!current) return null
  return (
    <div className="tutorial-hint">
      <span className="tutorial-step">
        {step + 1}/{STEPS.length}
      </span>
      {current.hint}
    </div>
  )
}

const SEEN_KEY = 'solar-oasis.mapCompleteSeen'

/** Shown once when every pad on the map is built. */
export function MapComplete({ onSell }: { onSell?: () => void }) {
  const complete = useGame((s) => s.state.mapComplete)
  const mapId = useGame((s) => s.state.mapId)
  const stats = useGame((s) => s.state.stats)
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === mapId
    } catch {
      return false
    }
  })
  if (!complete || seen) return null
  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, mapId)
    } catch {
      // Shown again next launch in private mode.
    }
    setSeen(true)
  }
  return (
    <div className="card-backdrop" data-hud-control>
      <div className="card card-celebrate" role="dialog" aria-label="Map complete">
        <h2>🎉 {getContent(mapId).map.name} complete!</h2>
        <ul className="card-stats">
          <li>
            <strong>{formatCash(stats.totalEarned)}</strong> earned
          </li>
          <li>
            <strong>{stats.carsServed.toLocaleString()}</strong> cars charged
          </li>
          <li>
            <strong>{Math.round(stats.energyDelivered).toLocaleString()} kWh</strong> of sunshine
            sold
          </li>
        </ul>
        <div className="card-actions">
          <button className="btn btn-primary" disabled={!onSell} onClick={onSell}>
            Sell to the utility{onSell ? '' : ' · Coming soon'}
          </button>
          <button className="btn" onClick={close}>
            Keep playing
          </button>
        </div>
      </div>
    </div>
  )
}

/** A sandy tint over the whole screen while a sandstorm blows. */
export function StormOverlay() {
  const storm = useGame((s) => {
    const e = s.state.event
    return !!e && e.kind === 'sandstorm' && s.state.time >= e.startsAt && s.state.time < e.endsAt
  })
  const snowy = useGame((s) => getContent(s.state.mapId).map.theme === 'snow')
  return (
    <div
      className={`storm-overlay${snowy ? ' storm-snow' : ''}${storm ? ' storm-on' : ''}`}
      aria-hidden
    />
  )
}

/** Taxi fleet contracts (map 2): serve N taxis before the deadline for a bonus. */
export function ContractBanner() {
  const contract = useGame(
    useShallow((s) => {
      const c = s.state.contract
      return c
        ? {
            served: c.taxisServed,
            required: c.taxisRequired,
            left: Math.max(0, Math.ceil(c.endsAt - s.state.time)),
            bonus: c.bonus,
          }
        : { served: 0, required: 0, left: 0, bonus: 0 }
    }),
  )
  if (contract.required === 0) return null
  return (
    <div className="event-banner contract-banner">
      🚕 Fleet contract: {Math.min(contract.served, contract.required)}/{contract.required} taxis ·{' '}
      {formatDuration(contract.left)} · +{formatCash(contract.bonus)}
    </div>
  )
}
