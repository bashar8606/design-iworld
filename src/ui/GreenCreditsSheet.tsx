import { incomeLevelPrice } from '../game/actions.ts'
import { getContent } from '../game/content.ts'
import { useGame } from '../store/gameStore.ts'
import { useUi } from '../store/uiStore.ts'
import { Sheet } from './Sheet.tsx'

/** Green Credits from selling maps buy permanent income levels that carry across maps. */
export function GreenCreditsSheet() {
  const open = useUi((s) => s.open)
  const prestige = useGame((s) => s.state.prestige)
  const mapId = useGame((s) => s.state.mapId)
  const dispatch = useGame((s) => s.dispatch)
  const content = getContent(mapId)
  const price = incomeLevelPrice(prestige.incomeLevel, content)
  const bonus = Math.round(content.economy.prestige.incomePerLevel * prestige.incomeLevel * 100)
  const next = Math.round(content.economy.prestige.incomePerLevel * 100)
  return (
    <Sheet title="Green Credits" onClose={() => open(null)}>
      <p className="card-amount">🌿 {prestige.greenCredits}</p>
      <p className="sheet-note">
        Income bonus: +{bonus}% on every map · maps sold: {prestige.mapsCompleted.length}
      </p>
      <div className="upgrade-row">
        <div className="upgrade-text">
          <strong>Income level {prestige.incomeLevel + 1}</strong>
          <span>+{next}% income, forever</span>
        </div>
        <button
          className="btn btn-buy"
          disabled={prestige.greenCredits < price}
          onClick={() => dispatch({ type: 'buyIncomeLevel' })}
        >
          🌿 {price}
        </button>
      </div>
    </Sheet>
  )
}
