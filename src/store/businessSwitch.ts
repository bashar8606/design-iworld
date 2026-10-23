// Switching between the charging station and the quarry from the UI.
import type { BusinessId } from '../game/business.ts'
import { getContent } from '../game/content.ts'
import { useGame } from './gameStore.ts'
import { saveNow } from './persistence.ts'
import { trackUi } from './tracking.ts'
import { useUi } from './uiStore.ts'

/** Shows `to`, with a welcome-back card for what the station earned while it was off screen. */
export function goToBusiness(to: BusinessId): void {
  const game = useGame.getState()
  if (game.business === to) {
    useUi.getState().open(null)
    return
  }
  const opened = to === 'quarry' && !game.quarry
  const { earned, awaySeconds } = game.switchTo(to)
  const ui = useUi.getState()
  ui.open(null)
  const { minSecondsForCard } = getContent(game.state.mapId).economy.offline
  if (to === 'station' && earned > 0 && awaySeconds >= minSecondsForCard)
    ui.showOffline(earned, awaySeconds)
  trackUi(opened ? 'quarry_opened' : 'business_switched', { to })
  void saveNow()
}
