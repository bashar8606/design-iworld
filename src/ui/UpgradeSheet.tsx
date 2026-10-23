import { useShallow } from 'zustand/react/shallow'
import { gemsToSkip } from '../game/actions.ts'
import { getContent } from '../game/content.ts'
import { dist } from '../game/vec.ts'
import { useGame } from '../store/gameStore.ts'
import { useTutorial } from '../store/tutorial.ts'
import { useUi } from '../store/uiStore.ts'
import { formatCash, formatDuration } from './format.ts'
import { Sheet } from './Sheet.tsx'
import { type UpgradeOption, upgradeOptions } from './upgrades.ts'

function UpgradeRow({ option, compact = false }: { option: UpgradeOption; compact?: boolean }) {
  const cash = useGame((s) => s.state.cash)
  const time = useGame((s) => Math.floor(s.state.time))
  const dispatch = useGame((s) => s.dispatch)
  const gems = useGame((s) => s.state.gems)
  const busy = option.upgradingUntil > 0
  const gemCost = busy ? gemsToSkip(option.upgradingUntil - time) : 0
  const affordable = option.price !== null && cash >= option.price
  return (
    <div className={`upgrade-row${compact ? ' upgrade-compact' : ''}`}>
      <div className="upgrade-text">
        <strong>{option.title}</strong>
        <span>
          {option.from}
          {option.to && ` → ${option.to}`}
          {busy && ` · ready in ${formatDuration(option.upgradingUntil - time)}`}
          {!busy &&
            option.to &&
            option.buildSeconds > 0 &&
            ` · takes ${formatDuration(option.buildSeconds)}`}
        </span>
      </div>
      {option.to && !busy ? (
        <button
          className="btn btn-buy"
          disabled={!affordable}
          onClick={() => dispatch(option.action)}
        >
          {formatCash(option.price ?? 0)}
        </button>
      ) : busy && option.action.type === 'upgrade' ? (
        <button
          className="btn btn-buy"
          disabled={gems < gemCost}
          onClick={() => dispatch({ type: 'skipUpgradeWithGems', id: option.id })}
          aria-label={`Finish now for ${gemCost} gems`}
        >
          💎 {gemCost}
        </button>
      ) : (
        <span className="upgrade-max">Max</span>
      )}
    </div>
  )
}

export function UpgradeSheet() {
  const close = useUi((s) => s.open)
  const options = useGame(
    useShallow((s) =>
      upgradeOptions(s.state, getContent(s.state.mapId)).map((o) => JSON.stringify(o)),
    ),
  ).map((o) => JSON.parse(o) as UpgradeOption)
  return (
    <Sheet title="Upgrades" onClose={() => close(null)}>
      {options.map((o) => (
        <UpgradeRow key={o.id} option={o} />
      ))}
    </Sheet>
  )
}

/** When the player stands by something upgradeable, offer its next upgrade in a small card. */
export function NearbyUpgrade() {
  const option = useGame((s) => {
    const content = getContent(s.state.mapId)
    const near = upgradeOptions(s.state, content)
      .filter((o) => o.to || o.upgradingUntil > 0)
      .map((o) => ({ o, d: dist(s.state.player.pos, o.pos) }))
      .filter(({ d }) => d < 2.2)
      .sort((a, b) => a.d - b.d)[0]
    return near ? JSON.stringify(near.o) : null
  })
  const sheet = useUi((s) => s.sheet)
  const tutorial = useTutorial((s) => s.active)
  if (!option || sheet || tutorial) return null
  return (
    <div className="nearby-upgrade" data-hud-control>
      <UpgradeRow option={JSON.parse(option) as UpgradeOption} compact />
    </div>
  )
}
