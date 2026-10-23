import { useState } from 'react'
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
  const info = useGame((s) => {
    const e = s.state.event
    if (!e) return null
    const t = s.state.time
    if (t < e.startsAt)
      return { kind: e.kind, phase: 'soon' as const, seconds: Math.ceil(e.startsAt - t) }
    if (t < e.endsAt)
      return { kind: e.kind, phase: 'now' as const, seconds: Math.ceil(e.endsAt - t) }
    return null
  })
  if (!info) return null
  const text =
    info.kind === 'sandstorm'
      ? info.phase === 'soon'
        ? `🌪️ Sandstorm in ${info.seconds} s: panels will drop to half power`
        : `🌪️ Sandstorm! Panels at half power · ${info.seconds} s`
      : info.phase === 'soon'
        ? `🔥 Heatwave in ${info.seconds} s: double the cars tonight`
        : `🔥 Heatwave! Double the cars · ${info.seconds} s`
  return <div className={`event-banner event-${info.kind}`}>{text}</div>
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
