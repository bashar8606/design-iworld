// The 2-minute tutorial: plug in the first car, collect the cash, build a charger, build a
// solar row. Finished (or skipped) once, it never shows again.
import { create } from 'zustand'
import { getContent } from '../game/content.ts'
import type { GameState, Vec2 } from '../game/types.ts'
import { bayDef } from '../game/world.ts'
import { onGameEvent } from './events.ts'
import { useGame } from './gameStore.ts'
import { trackUi } from './tracking.ts'

export const TUTORIAL_KEY = 'solar-oasis.tutorial'

export interface TutorialStep {
  id: 'plug' | 'collect' | 'charger' | 'panel'
  hint: string
  /** Where the arrow points, from the current state. */
  target: (s: GameState) => Vec2 | null
  /** Already satisfied by the current state (resuming a save). */
  done: (s: GameState) => boolean
}

const padPos = (s: GameState, id: string) =>
  getContent(s.mapId).map.pads.find((p) => p.id === id)?.pos ?? null

export const STEPS: TutorialStep[] = [
  {
    id: 'plug',
    hint: 'Walk to the car and plug it in',
    target: (s) => {
      const charger = s.chargers.find((c) =>
        s.cars.some((car) => car.id === c.carId && car.phase === 'waiting'),
      )
      const bayId = charger?.bayId ?? s.chargers[0]?.bayId
      return bayId ? bayDef(getContent(s.mapId).map, bayId).post : null
    },
    done: (s) => s.stats.carsServed > 0,
  },
  {
    id: 'collect',
    hint: 'Walk over the cash to collect it',
    target: (s) => s.pickups[0]?.pos ?? null,
    done: (s) => s.milestones.firstCashAt !== null,
  },
  {
    id: 'charger',
    hint: 'Stand on the pad to build a second charger',
    target: (s) => padPos(s, 'charger2'),
    done: (s) => !!s.pads.charger2?.built,
  },
  {
    id: 'panel',
    hint: 'Build a solar row to power both chargers',
    target: (s) => padPos(s, 'panel2'),
    done: (s) => !!s.pads.panel2?.built,
  },
]

function loadStep(): number {
  try {
    const v = localStorage.getItem(TUTORIAL_KEY)
    return v === 'done' ? STEPS.length : Number(v ?? 0) || 0
  } catch {
    return 0
  }
}

function saveStep(step: number) {
  try {
    localStorage.setItem(TUTORIAL_KEY, step >= STEPS.length ? 'done' : String(step))
  } catch {
    // Private mode: the tutorial may show again next time.
  }
}

export const useTutorial = create<{ step: number; active: boolean }>()(() => ({
  step: loadStep(),
  active: loadStep() < STEPS.length,
}))

export function resetTutorial() {
  saveStep(0)
  useTutorial.setState({ step: 0, active: true })
}

/** Advances the tutorial as the game state changes; returns a cleanup. */
export function startTutorial(): () => void {
  const advance = () => {
    const { step, active } = useTutorial.getState()
    if (!active) return
    const { state } = useGame.getState()
    let next = step
    while (next < STEPS.length && STEPS[next]!.done(state)) {
      trackUi('tutorial_step', { step: STEPS[next]!.id, index: next })
      next++
    }
    if (next !== step) {
      saveStep(next)
      useTutorial.setState({ step: next, active: next < STEPS.length })
      if (next >= STEPS.length) trackUi('tutorial_complete')
    }
  }
  if (useTutorial.getState().active && useTutorial.getState().step === 0) trackUi('tutorial_start')
  const off = onGameEvent(advance)
  const unsub = useGame.subscribe((s, prev) => {
    if (s.state.mapId !== prev.state.mapId || s.state.time < prev.state.time) advance()
  })
  advance()
  return () => {
    off()
    unsub()
  }
}

/** True during the tutorial or a player's first 10 minutes (no interstitials then). */
export function inTutorialWindow(playSeconds: number): boolean {
  return useTutorial.getState().active || playSeconds < 600
}
