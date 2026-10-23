import pacing from '../content/pacing.json'
import { MAP_ORDER, getContent } from '../game/content.ts'
import { createInitialState } from '../game/state.ts'
import { NO_INPUT, tick } from '../game/tick.ts'
import { STRESS_KEY, quality } from '../scene/quality.ts'
import { useGame } from '../store/gameStore.ts'
import { catchUp } from '../store/lifecycle.ts'
import { resetSave, saveNow } from '../store/persistence.ts'
import { resetTutorial, useTutorial } from '../store/tutorial.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet } from './Sheet.tsx'

/** Hidden debug menu (five taps on the clock): cash, time skips, save reset, stress test. */
export function DebugMenu() {
  const open = useUi((s) => s.open)
  const game = useGame()
  const skipPlay = (seconds: number) => {
    let s = useGame.getState().state
    for (let t = 0; t < seconds; t += 0.1) s = tick(s, 0.1, NO_INPUT)
    game.replace({ ...s, events: [] })
  }
  const skipAway = (seconds: number) => {
    const now = Date.now()
    const result = catchUp(useGame.getState().state, now - seconds * 1000, now)
    game.replace(result.state)
    useUi.getState().showOffline(result.earned, result.awaySeconds)
    open(null)
  }
  // Starts a later map as if the earlier ones were sold, with the income levels the sim assumes.
  const jumpTo = (mapId: string) => {
    const s = useGame.getState().state
    const start =
      (pacing.maps as Record<string, { startIncomeLevel?: number }>)[mapId]?.startIncomeLevel ?? 0
    useTutorial.setState({ active: false })
    game.replace(
      createInitialState(mapId, {
        seed: s.seed,
        carry: {
          gems: s.gems,
          boosts: s.boosts,
          ledger: s.ledger,
          collection: s.collection,
          prestige: {
            ...s.prestige,
            incomeLevel: Math.max(s.prestige.incomeLevel, start),
            mapsCompleted: MAP_ORDER.slice(0, MAP_ORDER.indexOf(mapId)),
          },
        },
      }),
    )
    void saveNow()
    open(null)
  }
  const setStress = (on: boolean) => {
    try {
      if (on) localStorage.setItem(STRESS_KEY, '1')
      else localStorage.removeItem(STRESS_KEY)
    } catch {
      // ignore
    }
    window.location.reload()
  }
  return (
    <Sheet title="Debug" onClose={() => open(null)}>
      <div className="sheet-actions">
        <button
          className="btn"
          onClick={() => game.dispatch({ type: 'debugAddCash', amount: 1000 })}
        >
          + $1,000
        </button>
        <button
          className="btn"
          onClick={() => game.dispatch({ type: 'debugAddCash', amount: 100_000 })}
        >
          + $100,000
        </button>
        <button className="btn" onClick={() => skipPlay(60)}>
          Skip 1 minute
        </button>
        <button className="btn" onClick={() => skipAway(3600)}>
          Away for 1 hour
        </button>
        <button className="btn" onClick={() => game.setSpeed(game.speed === 1 ? 5 : 1)}>
          Speed ×{game.speed === 1 ? 5 : 1}
        </button>
        <button className="btn" onClick={() => void saveNow()}>
          Save now
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            void resetSave().then(() => {
              resetTutorial()
              game.replace(createInitialState())
              open(null)
            })
          }}
        >
          Reset save
        </button>
        {MAP_ORDER.map((id) => (
          <button key={id} className="btn" onClick={() => jumpTo(id)}>
            Play {getContent(id).map.name}
          </button>
        ))}
        <button className="btn" onClick={() => setStress(!quality.stress)}>
          {quality.stress ? 'Leave stress test' : 'Stress test'}
        </button>
      </div>
      <p className="sheet-note">Three-finger tap shows the performance overlay.</p>
    </Sheet>
  )
}
