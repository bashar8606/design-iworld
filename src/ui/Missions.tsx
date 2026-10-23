import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { albumClaimable } from '../game/collection.ts'
import { missionDone } from '../game/missions.ts'
import type { Mission } from '../game/types.ts'
import { useGame } from '../store/gameStore.ts'
import { useTutorial } from '../store/tutorial.ts'
import { useUi } from '../store/uiStore.ts'
import { formatCash } from './format.ts'
import { missionCount, missionTitle } from './missionText.ts'
import { Album } from './Album.tsx'
import { Sheet } from './Sheet.tsx'

/** The active missions, compared by content so the selector stays stable between ticks. */
function useMissions(): Mission[] {
  return useGame(
    useShallow((s) =>
      s.state.missions.active.map((m) =>
        JSON.stringify({ ...m, progress: Math.floor(m.progress) }),
      ),
    ),
  ).map((m) => JSON.parse(m) as Mission)
}

function Progress({ mission }: { mission: Mission }) {
  const f = Math.min(1, mission.progress / mission.target)
  return (
    <div className="mission-progress">
      <div className="mission-progress-fill" style={{ width: `${f * 100}%` }} />
      <span>{missionCount(mission)}</span>
    </div>
  )
}

/** The closest-to-done mission under the top bar; tap to claim it or to see all missions. */
export function MissionCard() {
  const missions = useMissions()
  const open = useUi((s) => s.open)
  const dispatch = useGame((s) => s.dispatch)
  const tutorial = useTutorial((s) => s.active)
  if (tutorial || missions.length === 0) return null
  const mission = [...missions].sort((a, b) => b.progress / b.target - a.progress / a.target)[0]!
  const done = missionDone(mission)
  return (
    <button
      className={`mission-card${done ? ' is-done' : ''}`}
      data-hud-control
      onClick={() => (done ? dispatch({ type: 'claimMission', id: mission.id }) : open('missions'))}
      aria-label={done ? `Claim: ${missionTitle(mission)}` : `Mission: ${missionTitle(mission)}`}
    >
      <span className="mission-card-text">
        <strong>{missionTitle(mission)}</strong>
        <Progress mission={mission} />
      </span>
      <span className="mission-gift" aria-hidden>
        🎁
      </span>
    </button>
  )
}

export function MissionsSheet() {
  const open = useUi((s) => s.open)
  const [tab, setTab] = useState<'missions' | 'album'>('missions')
  const missionsReady = useGame((s) => s.state.missions.active.filter(missionDone).length)
  const albumReady = useGame((s) => albumClaimable(s.state))
  return (
    <Sheet title={tab === 'album' ? 'Car album' : 'Missions'} onClose={() => open(null)}>
      <div className="sheet-tabs" role="tablist">
        {(
          [
            ['missions', '🎁 Missions', missionsReady],
            ['album', '📒 Album', albumReady],
          ] as const
        ).map(([id, label, badge]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`sheet-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
            {badge > 0 && <span className="nav-badge sheet-tab-badge">{badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'album' ? <Album /> : <MissionList />}
    </Sheet>
  )
}

function MissionList() {
  const missions = useMissions()
  const dispatch = useGame((s) => s.dispatch)
  return (
    <>
      {missions.map((m) => {
        const done = missionDone(m)
        return (
          <div key={m.id} className={`mission-row${done ? ' is-done' : ''}`}>
            <span className="mission-row-icon" aria-hidden>
              🎁
            </span>
            <div className="mission-row-text">
              <strong>{missionTitle(m)}</strong>
              <Progress mission={m} />
              <small>
                Reward: {formatCash(m.rewardCash)} · 💎 {m.rewardGems}
              </small>
            </div>
            <button
              className="btn btn-buy"
              disabled={!done}
              onClick={() => dispatch({ type: 'claimMission', id: m.id })}
            >
              Claim
            </button>
          </div>
        )
      })}
      <p className="sheet-note">A new mission takes the place of each one you claim.</p>
    </>
  )
}
