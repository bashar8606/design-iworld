import { useEffect, useRef, useState } from 'react'
import { collection } from '../game/collection.ts'
import { getContent } from '../game/content.ts'
import { isNight, isPadUnlocked } from '../game/world.ts'
import { onGameEvent } from '../store/events.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { clockTime, formatCash } from './format.ts'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Day number, weekday and clock time; five quick taps open the debug menu. */
function TimePill({ onTap }: { onTap: () => void }) {
  // Rounded to 10 game minutes so the clock ticks without re-rendering every frame.
  const dayTime = useGame((s) => Math.floor(s.state.dayTime * 144) / 144)
  const day = useGame((s) => s.state.day)
  const mapId = useGame((s) => s.state.mapId)
  const night = isNight(dayTime, getContent(mapId).map)
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

/** Battery glyph whose fill and colour follow the stored charge. */
function BatteryIcon({ fill }: { fill: number }) {
  const color = fill > 0.5 ? '#2BB673' : fill > 0.2 ? '#F2B233' : '#E5484D'
  return (
    <svg className="energy-battery" viewBox="0 0 16 26" aria-hidden>
      <rect x="4.5" y="0.5" width="7" height="3" rx="1" fill="#1E2A44" />
      <rect
        x="1"
        y="3"
        width="14"
        height="22"
        rx="3"
        fill="#FFFFFF"
        stroke="#1E2A44"
        strokeWidth="2"
      />
      <rect x="3.5" y={5.5 + 17 * (1 - fill)} width="9" height={17 * fill} rx="1.5" fill={color} />
      <path
        d="M9 9 L5.5 15 H8 L7 20 L10.5 13.5 H8 Z"
        fill="#FFFFFF"
        opacity={fill > 0.25 ? 1 : 0}
      />
    </svg>
  )
}

/** Panels in, battery level, chargers out. */
function EnergyPanel() {
  const produced = useGame((s) => Math.round(s.state.energy.produced))
  const delivered = useGame((s) => Math.round(s.state.energy.delivered))
  const capacity = useGame((s) => s.state.energy.capacity)
  const fill = useGame((s) =>
    s.state.energy.capacity > 0
      ? Math.round((s.state.energy.stored / s.state.energy.capacity) * 100) / 100
      : 0,
  )
  const blackout = useGame((s) => s.state.energy.blackout)
  return (
    <div className={`top-energy${blackout ? ' is-alert' : ''}`} aria-label="Energy">
      <div className="energy-stat">
        <span className="energy-icon" aria-hidden>
          ☀️
        </span>
        <span>
          <strong>{produced} kW</strong>
          <small>Generating</small>
        </span>
      </div>
      <div className="energy-stat">
        <BatteryIcon fill={fill} />
        <span>
          <strong>{capacity > 0 ? `${Math.round(fill * 100)}%` : '—'}</strong>
          <small>{capacity > 0 ? 'Storage' : 'No battery'}</small>
        </span>
      </div>
      <div className="energy-stat">
        <span className="energy-icon energy-bolt" aria-hidden>
          ⚡
        </span>
        <span>
          <strong>{delivered} kW</strong>
          <small>Consuming</small>
        </span>
      </div>
    </div>
  )
}

/** Cash that rolls toward its new value; the + opens the shop. */
function CashPill() {
  const cash = useGame((s) => Math.floor(s.state.cash))
  const open = useUi((s) => s.open)
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
    <div className="top-cash" aria-label="Cash">
      <span className="top-cash-icon" aria-hidden>
        💵
      </span>
      <strong>{formatCash(shown)}</strong>
      <button
        className="top-cash-plus"
        data-hud-control
        onClick={() => open('shop')}
        aria-label="Shop"
      >
        +
      </button>
    </div>
  )
}

interface Toast {
  id: number
  text: string
  tone: 'bad' | 'good' | 'info'
}

/** Short messages: angry drivers, nightfall, contracts, milestones. */
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
      } else if (e.type === 'nightStarted') {
        const { map } = getContent(state.mapId)
        push(
          map.cold && state.energy.capacity > 0
            ? 'A cold night: the batteries drain faster'
            : state.energy.capacity > 0
              ? 'Night falls: running on batteries'
              : state.turbines.length > 0
                ? 'Night falls: only the wind is working'
                : 'Night falls: the panels stop',
          'info',
        )
      } else if (e.type === 'dayStarted' && e.survived) {
        push('You made it through the night', 'good')
      } else if (e.type === 'padBuilt') {
        const { map } = getContent(state.mapId)
        const zoneName = (id?: string) => map.zones?.find((z) => z.id === id)?.name
        if (e.kind === 'land') {
          const name = zoneName(map.pads.find((p) => p.id === e.padId)?.opensZone)
          if (name) push(`${name} is yours!`, 'good')
        }
        // Land that just went on sale.
        for (const land of map.pads.filter((p) => p.opensZone && p.unlockAfter?.includes(e.padId)))
          if (isPadUnlocked(state, land, map))
            push(`New land for sale: ${zoneName(land.opensZone)}`, 'info')
      } else if (e.type === 'cardFound') {
        const card = collection.cards.find((c) => c.id === e.cardId)
        if (card) push(`New in your car album: ${card.name}!`, 'good')
      } else if (e.type === 'carArrived') {
        const car = state.cars.find((c) => c.id === e.carId)
        if (car?.golden) push(`A golden ${car.type} is here: it pays double!`, 'good')
      } else if (e.type === 'mapComplete') {
        push('Map complete!', 'good')
      } else if (e.type === 'contractDone') {
        push(`Fleet contract done: +${formatCash(e.bonus)}`, 'good')
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
      <div className="top-bar">
        <TimePill onTap={onClockTap} />
        <EnergyPanel />
        <CashPill />
      </div>
      <Toasts />
      {children}
    </div>
  )
}
