// Mission labels and the nav badge count, shared by the mission card, sheet and bottom nav.
import { missionDone } from '../game/missions.ts'
import type { Mission } from '../game/types.ts'
import { useGame } from '../store/gameStore.ts'
import { formatCash } from './format.ts'

/** "Serve {n} car{s}" → "Serve 10 cars"; cash targets read as money. */
export function missionTitle(m: Mission): string {
  return m.title
    .replace('{n}', m.kind === 'collectCash' ? formatCash(m.target) : String(m.target))
    .replace('{s}', m.target === 1 ? '' : 's')
}

export function missionCount(m: Mission): string {
  if (m.kind === 'collectCash') return `${formatCash(m.progress)}/${formatCash(m.target)}`
  return `${Math.floor(m.progress)}/${m.target}`
}

/** Missions ready to claim, for the nav badge. */
export function useClaimableMissions(): number {
  return useGame((s) => s.state.missions.active.filter(missionDone).length)
}
