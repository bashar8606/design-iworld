import { getContent } from '../game/content.ts'
import { layoutProblems } from '../game/layout.ts'
import { getQuarryContent } from '../game/quarry/content.ts'
import { quarryLayoutProblems } from '../game/quarry/layout.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'

const LEGEND = [
  ['#1E6FD9', 'Built item (largest size)'],
  ['#19B5A5', 'Build pad'],
  ['#8A5CF6', 'Parked vehicle (longest)'],
  ['#F29E4C', 'Cash stack / café queue'],
  ['#7A7F87', 'Entry lane'],
  ['#B08D57', 'Plaza'],
  ['#0E7F74', 'Energy-yard fence'],
  ['#3E9B5F', 'Palms, lamps, planters'],
  ['#C2410C', 'Way out through the car wash'],
  ['#F7C948', 'Zone border'],
  ['#E5484D', 'Problem'],
] as const

const QUARRY_LEGEND = [
  ['#19B5A5', 'Pad'],
  ['#1E6FD9', 'Building'],
  ['#8A5CF6', 'Stockpile'],
  ['#3E9B5F', 'Rock face'],
  ['#C2410C', 'Haul road, buyers road, conveyor'],
  ['#F29E4C', 'Where the player walks'],
  ['#F7C948', 'Pit and bench 2 rims'],
  ['#E5484D', 'Problem'],
] as const

/** Shown instead of the HUD in the debug layout view: a legend, the problem count and Exit. */
export function LayoutViewBar() {
  const mapId = useGame((s) => s.state.mapId)
  const quarryId = useGame((s) => (s.business === 'quarry' ? s.quarry?.quarryId : undefined))
  const setLayoutView = useUi((s) => s.setLayoutView)
  const quarry = quarryId ? getQuarryContent(quarryId).quarry : null
  const problems = quarry ? quarryLayoutProblems(quarry) : layoutProblems(getContent(mapId))
  const name = quarry ? quarry.name : getContent(mapId).map.name
  return (
    <div className="layout-bar" data-hud-control>
      <strong>
        {name}: {problems.length === 0 ? 'no layout problems' : `${problems.length} problems`}
      </strong>
      <ul>
        {(quarry ? QUARRY_LEGEND : LEGEND).map(([color, label]) => (
          <li key={label}>
            <span style={{ background: color }} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      {problems.length > 0 && (
        <ol className="layout-problems">
          {problems.slice(0, 8).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      )}
      <button className="btn" onClick={() => setLayoutView(false)}>
        Exit layout view
      </button>
    </div>
  )
}
