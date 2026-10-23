import { useState } from 'react'
import { type BusinessId, quarryUnlocked } from '../game/business.ts'
import { MAP_ORDER, getContent } from '../game/content.ts'
import { QUARRY_ORDER, getQuarryContent } from '../game/quarry/content.ts'
import { goToBusiness } from '../store/businessSwitch.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet } from './Sheet.tsx'

const THEME_ICONS = { desert: '🏜️', city: '🏙️', snow: '🏔️' } as const

/** Every station: where the player is, which maps are sold, and the Green Credits they earned. */
function Stations({ onScreen }: { onScreen: boolean }) {
  const open = useUi((s) => s.open)
  const mapId = useGame((s) => s.state.mapId)
  const complete = useGame((s) => s.state.mapComplete)
  const sold = useGame((s) => s.state.prestige.mapsCompleted)
  const credits = useGame((s) => s.state.prestige.greenCredits)
  const dispatch = useGame((s) => s.dispatch)
  const current = MAP_ORDER.indexOf(mapId)
  return (
    <>
      {MAP_ORDER.map((id, i) => {
        const { map } = getContent(id)
        const here = id === mapId
        const done = sold.includes(id)
        const status = here
          ? complete
            ? 'Complete: sell it to move on'
            : onScreen
              ? 'You are here'
              : 'Your station'
          : done
            ? 'Sold to the utility'
            : i > current
              ? `Finish ${getContent(MAP_ORDER[i - 1] ?? mapId).map.name} to unlock`
              : ''
        return (
          <div
            key={id}
            className={`map-row${here ? ' is-here' : ''}${!here && !done ? ' is-locked' : ''}`}
          >
            <span className="map-row-icon" aria-hidden>
              {done && !here ? '✅' : here ? THEME_ICONS[map.theme] : '🔒'}
            </span>
            <div className="map-row-text">
              <strong>{map.name}</strong>
              <small>{status}</small>
            </div>
            {here && !onScreen && (
              <button className="btn btn-buy" onClick={() => goToBusiness('station')}>
                Go
              </button>
            )}
            {here && onScreen && complete && (
              <button
                className="btn btn-buy"
                onClick={() => {
                  dispatch({ type: 'sellToUtility' })
                  open('greenCredits')
                }}
              >
                Sell
              </button>
            )}
          </div>
        )
      })}
      <button className="btn" onClick={() => open('greenCredits')}>
        🌿 Green Credits · {credits}
      </button>
    </>
  )
}

/** The quarries: Pine Ridge opens after the first station, the rest come later. */
function Quarries({ onScreen }: { onScreen: boolean }) {
  const unlocked = useGame((s) => quarryUnlocked(s.state))
  const { quarry } = getQuarryContent(QUARRY_ORDER[0]!)
  const after = getContent(quarry.unlock.afterMap).map.name
  return (
    <>
      <p className="map-section-note">
        An electric quarry in the pines: dig the benches, haul the rock, crush it and sell the
        gravel. It earns on its own while you run the station.
      </p>
      <div
        className={`map-row${onScreen ? ' is-here' : ''}${unlocked || onScreen ? '' : ' is-locked'}`}
      >
        <span className="map-row-icon" aria-hidden>
          {unlocked || onScreen ? '⛏️' : '🔒'}
        </span>
        <div className="map-row-text">
          <strong>{quarry.name}</strong>
          <small>
            {onScreen
              ? 'You are here'
              : unlocked
                ? 'Open: Rosa is waiting'
                : `Finish ${after} to unlock`}
          </small>
        </div>
        {unlocked && !onScreen && (
          <button className="btn btn-buy" onClick={() => goToBusiness('quarry')}>
            Go
          </button>
        )}
      </div>
      {quarry.next.map((q) => (
        <div key={q.id} className="map-row is-locked">
          <span className="map-row-icon" aria-hidden>
            🔒
          </span>
          <div className="map-row-text">
            <strong>{q.name}</strong>
            <small>Coming later</small>
          </div>
        </div>
      ))}
    </>
  )
}

/** Both businesses: the charging stations and the quarries, with a way to switch between them. */
export function MapSheet() {
  const open = useUi((s) => s.open)
  const business = useGame((s) => (s.business === 'quarry' && s.quarry ? 'quarry' : 'station'))
  const [tab, setTab] = useState<BusinessId>(business)
  return (
    <Sheet title="Map" onClose={() => open(null)}>
      <div className="map-tabs" role="group" aria-label="Business">
        <button aria-pressed={tab === 'station'} onClick={() => setTab('station')}>
          ⚡ Stations
        </button>
        <button aria-pressed={tab === 'quarry'} onClick={() => setTab('quarry')}>
          ⛏️ Quarries
        </button>
      </div>
      {tab === 'station' ? (
        <Stations onScreen={business === 'station'} />
      ) : (
        <Quarries onScreen={business === 'quarry'} />
      )}
    </Sheet>
  )
}
