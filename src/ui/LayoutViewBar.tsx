import { getContent } from '../game/content.ts'
import { layoutProblems } from '../game/layout.ts'
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

/** Shown instead of the HUD in the debug layout view: a legend, the problem count and Exit. */
export function LayoutViewBar() {
  const mapId = useGame((s) => s.state.mapId)
  const setLayoutView = useUi((s) => s.setLayoutView)
  const problems = layoutProblems(getContent(mapId))
  return (
    <div className="layout-bar" data-hud-control>
      <strong>
        {getContent(mapId).map.name}:{' '}
        {problems.length === 0 ? 'no layout problems' : `${problems.length} problems`}
      </strong>
      <ul>
        {LEGEND.map(([color, label]) => (
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
