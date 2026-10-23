import { useEffect, useRef, useState } from 'react'
import { useUi } from '../store/uiStore.ts'
import { getContent } from '../game/content.ts'
import { onGameEvent } from '../store/events.ts'
import { useGame } from '../store/gameStore.ts'
import { formatCash } from './format.ts'

/** Cash that rolls toward its new value instead of jumping. */
function RollingCash() {
  const cash = useGame((s) => Math.floor(s.state.cash))
  const [shown, setShown] = useState(cash)
  const shownRef = useRef(cash)
  useEffect(() => {
    let frame = 0
    const step = () => {
      const diff = cash - shownRef.current
      if (Math.abs(diff) < 1) {
        shownRef.current = cash
        setShown(cash)
        return
      }
      shownRef.current += diff * 0.18
      setShown(Math.round(shownRef.current))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [cash])
  return (
    <div className="hud-pill hud-cash" aria-label="Cash">
      <span className="hud-coin">●</span>
      {formatCash(shown)}
    </div>
  )
}

/** Day-night dial: the sun or moon marker travels round as the day passes. */
function ClockDial({ onTap }: { onTap?: () => void }) {
  const dayTime = useGame((s) => Math.round(s.state.dayTime * 200) / 200)
  const day = useGame((s) => s.state.day)
  const mapId = useGame((s) => s.state.mapId)
  const { sunrise, sunset } = getContent(mapId).map.day
  const night = dayTime <= sunrise || dayTime >= sunset
  const angle = dayTime * Math.PI * 2 - Math.PI / 2
  const r = 17
  // Daylight arc from sunrise to sunset.
  const a0 = sunrise * Math.PI * 2 - Math.PI / 2
  const a1 = sunset * Math.PI * 2 - Math.PI / 2
  const arc = `M ${22 + r * Math.cos(a0)} ${22 + r * Math.sin(a0)} A ${r} ${r} 0 1 1 ${22 + r * Math.cos(a1)} ${22 + r * Math.sin(a1)}`
  return (
    <button
      className="hud-pill hud-clock"
      data-hud-control
      onClick={onTap}
      aria-label={`Day ${day + 1}, ${night ? 'night' : 'day'}`}
    >
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill={night ? '#1D2756' : '#CFE9F7'}
          stroke="#1E3557"
          strokeOpacity="0.2"
          strokeWidth="4"
        />
        <path d={arc} fill="none" stroke="#F7C948" strokeWidth="4" strokeLinecap="round" />
        <circle
          cx={22 + r * Math.cos(angle)}
          cy={22 + r * Math.sin(angle)}
          r="5"
          fill={night ? '#E8ECFF' : '#F29E4C'}
        />
      </svg>
      <span>Day {day + 1}</span>
    </button>
  )
}

/** Panels in, battery level, chargers out. */
function EnergyBar() {
  const produced = useGame((s) => Math.round(s.state.energy.produced))
  const delivered = useGame((s) => Math.round(s.state.energy.delivered))
  const capacity = useGame((s) => s.state.energy.capacity)
  const fill = useGame((s) =>
    s.state.energy.capacity > 0
      ? Math.round((s.state.energy.stored / s.state.energy.capacity) * 100)
      : 0,
  )
  const blackout = useGame((s) => s.state.energy.blackout)
  return (
    <div className={`hud-pill hud-energy${blackout ? ' hud-alert' : ''}`} aria-label="Energy">
      <span title="Panels in">☀️ {produced} kW</span>
      <span className="hud-battery" title="Battery">
        <span className="hud-battery-fill" style={{ width: `${capacity > 0 ? fill : 0}%` }} />
        <span className="hud-battery-label">{capacity > 0 ? `${fill}%` : 'no battery'}</span>
      </span>
      <span title="Chargers out">⚡ {delivered} kW</span>
    </div>
  )
}

interface Toast {
  id: number
  text: string
  tone: 'bad' | 'good' | 'info'
}

/** Short messages: angry drivers, events, milestones. */
function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const lastAngry = useRef(0)
  useEffect(() => {
    let id = 0
    const push = (text: string, tone: Toast['tone']) => {
      const toast = { id: ++id, text, tone }
      setToasts((t) => [...t.slice(-2), toast])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 3200)
    }
    return onGameEvent((e) => {
      const { state } = useGame.getState()
      if (e.type === 'carLost') {
        const now = performance.now()
        if (now - lastAngry.current < 2500) return
        lastAngry.current = now
        push(
          state.energy.blackout
            ? 'A driver left angry: no power!'
            : 'A driver got tired of waiting',
          'bad',
        )
      } else if (e.type === 'eventAnnounced') {
        push(
          e.kind === 'sandstorm'
            ? 'Sandstorm in 30 s: panels at half power'
            : 'Heatwave tonight: double the cars',
          'info',
        )
      } else if (e.type === 'nightStarted') {
        push(
          state.energy.capacity > 0
            ? 'Night falls: running on batteries'
            : 'Night falls: the panels stop',
          'info',
        )
      } else if (e.type === 'dayStarted' && e.survived) {
        push('You made it through the night', 'good')
      } else if (e.type === 'mapComplete') {
        push('Map complete!', 'good')
      } else if (e.type === 'contractDone') {
        push(`Fleet contract done: +$${Math.round(e.bonus).toLocaleString('en-US')}`, 'good')
      } else if (e.type === 'contractFailed') {
        push('The fleet contract ran out of time', 'bad')
      }
    })
  }, [])
  return (
    <div className="hud-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`hud-toast hud-toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** Five quick taps on the clock open the hidden debug menu. */
function useFiveTaps(onFive: () => void) {
  const taps = useRef<number[]>([])
  return () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 1500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      onFive()
    }
  }
}

export function Hud({
  children,
  allowDebug = true,
}: {
  children?: React.ReactNode
  allowDebug?: boolean
}) {
  const open = useUi((s) => s.open)
  const onClockTap = useFiveTaps(() => allowDebug && open('debug'))
  return (
    <div className="hud">
      <div className="hud-bar">
        <ClockDial onTap={onClockTap} />
        <div className="hud-right">
          <RollingCash />
          <button
            className="hud-icon"
            data-hud-control
            onClick={() => open('settings')}
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>
      <div className="hud-bar hud-bar-center">
        <EnergyBar />
      </div>
      <Toasts />
      {children}
    </div>
  )
}
