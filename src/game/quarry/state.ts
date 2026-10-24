import { dayClock, sunIntensity } from '../world.ts'
import { getQuarryContent } from './content.ts'
import type { QuarryContent, QuarryPadDef, QuarryState, QuarryUpgradeId } from './types.ts'

export function createQuarryState(quarryId = 'quarry1', seed = 1): QuarryState {
  const { quarry } = getQuarryContent(quarryId)
  const { day, dayTime } = dayClock(0, quarry)
  return {
    quarryId,
    seed,
    time: 0,
    day,
    dayTime,
    sun: sunIntensity(dayTime, quarry),
    cash: 0,
    player: { pos: { ...quarry.player.start }, heading: 0, moving: false, carry: 0 },
    faces: Object.fromEntries(quarry.faces.map((f) => [f.id, f.rocks])),
    mineTimer: 0,
    dropTimer: 0,
    hopper: 0,
    belt: [],
    piles: Object.fromEntries(quarry.stockpiles.map((p) => [p.id, 0])),
    levels: { backpack: 0, crusher: 0, trucks: 0 },
    paid: { backpack: 0, crusher: 0, trucks: 0 },
    pads: Object.fromEntries(quarry.pads.map((p) => [p.id, { paid: 0, built: false }])),
    loader: null,
    broken: quarry.machines.excavator.startBrokenTons,
    digBuffer: 0,
    trucks: [],
    nextBlastAt: 0,
    buyers: [],
    nextBuyerId: 1,
    nextBuyerAt: quarry.buyers.firstDelaySeconds,
    stacks: [],
    nextStackId: 1,
    stats: {
      rocksMined: 0,
      tonsCrushed: 0,
      tonsSold: 0,
      buyersServed: 0,
      buyersLost: 0,
      totalEarned: 0,
    },
    events: [],
  }
}

/** True when a parsed save holds something shaped like a quarry. */
export function isQuarryState(value: unknown): value is QuarryState {
  if (typeof value !== 'object' || value === null) return false
  const q = value as Partial<QuarryState>
  return (
    typeof q.quarryId === 'string' &&
    typeof q.time === 'number' &&
    typeof q.player === 'object' &&
    q.player !== null &&
    typeof q.player.pos?.x === 'number'
  )
}

/** Fills in anything a quarry saved by an older version is missing. */
export function normalizeQuarry(saved: QuarryState): QuarryState {
  const fresh = createQuarryState(saved.quarryId)
  return {
    ...fresh,
    ...saved,
    player: { ...fresh.player, ...saved.player },
    faces: { ...fresh.faces, ...saved.faces },
    belt: saved.belt ?? [],
    piles: { ...fresh.piles, ...saved.piles },
    levels: { ...fresh.levels, ...saved.levels },
    paid: { ...fresh.paid, ...saved.paid },
    pads: { ...fresh.pads, ...saved.pads },
    trucks: saved.trucks ?? [],
    buyers: saved.buyers ?? [],
    stacks: saved.stacks ?? [],
    stats: { ...fresh.stats, ...saved.stats },
    events: [],
  }
}

/** Rocks the player can carry. */
export function backpackCapacity(state: QuarryState, quarry: QuarryContent): number {
  const { levels } = quarry.upgrades.backpack
  return levels[Math.min(state.levels.backpack, levels.length - 1)]!
}

/** Tons the crusher handles per second. */
export function crusherRate(state: QuarryState, quarry: QuarryContent): number {
  const { levels } = quarry.upgrades.crusher
  return levels[Math.min(state.levels.crusher, levels.length - 1)]!
}

export function padBuilt(state: QuarryState, id: string): boolean {
  return state.pads[id]?.built ?? false
}

/** Every listed pad is built (an empty list counts as met). */
export function requirementsMet(state: QuarryState, requires: string[] | undefined): boolean {
  return (requires ?? []).every((id) => padBuilt(state, id))
}

/** Pads the player can pay into now: not built yet, with everything they need built. */
export function openQuarryPads(state: QuarryState, quarry: QuarryContent): QuarryPadDef[] {
  return quarry.pads.filter((p) => !padBuilt(state, p.id) && requirementsMet(state, p.requires))
}

export function upgradeOpen(state: QuarryState, quarry: QuarryContent, id: QuarryUpgradeId) {
  return requirementsMet(state, quarry.upgrades[id].requires)
}

/** Tons each truck carries. */
export function truckCapacity(state: QuarryState, quarry: QuarryContent): number {
  const { levels } = quarry.upgrades.trucks
  return levels[Math.min(state.levels.trucks, levels.length - 1)]!
}

/** Price of an upgrade's next level, or null at the top level. */
export function nextUpgradePrice(
  state: QuarryState,
  quarry: QuarryContent,
  id: QuarryUpgradeId,
): number | null {
  return quarry.upgrades[id].prices[state.levels[id]] ?? null
}
