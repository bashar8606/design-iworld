import { MAP_ORDER, getContent } from '../game/content.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet } from './Sheet.tsx'

const THEME_ICONS = { desert: '🏜️', city: '🏙️', snow: '🏔️' } as const

/** Every station: where the player is, which maps are sold, and the Green Credits they earned. */
export function MapSheet() {
  const open = useUi((s) => s.open)
  const mapId = useGame((s) => s.state.mapId)
  const complete = useGame((s) => s.state.mapComplete)
  const sold = useGame((s) => s.state.prestige.mapsCompleted)
  const credits = useGame((s) => s.state.prestige.greenCredits)
  const dispatch = useGame((s) => s.dispatch)
  const current = MAP_ORDER.indexOf(mapId)
  return (
    <Sheet title="Map" onClose={() => open(null)}>
      {MAP_ORDER.map((id, i) => {
        const { map } = getContent(id)
        const here = id === mapId
        const done = sold.includes(id)
        const status = here
          ? complete
            ? 'Complete: sell it to move on'
            : 'You are here'
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
            {here && complete && (
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
    </Sheet>
  )
}
