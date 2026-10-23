// Player actions outside movement: upgrades, rewards, purchases and the prestige reset.
// Each returns a new state (or the same one when the action is not allowed).
import { getContent } from './content.ts'
import { Rng } from './rng.ts'
import { createInitialState } from './state.ts'
import { cloneState, spawnCar } from './tick.ts'
import type { Content, EquipmentKind, GameState } from './types.ts'
import { nextStaffLevelPrice, nextTierPrice } from './world.ts'

export type RewardPlacement =
  'solar_boost' | 'welcome_back' | 'instant_build' | 'vip_car' | 'blackout_rescue' | 'daily_chest'

export type GameAction =
  | { type: 'upgrade'; id: string }
  | { type: 'upgradeStaff'; id: string }
  | { type: 'reward'; placement: RewardPlacement; amount?: number }
  | { type: 'grant'; cash?: number; gems?: number; permanentX2?: boolean }
  | { type: 'skipUpgradeWithGems'; id: string }
  | { type: 'debugAddCash'; amount: number }
  /** Purchase grants and the updated ledger, applied together. */
  | {
      type: 'applyPurchases'
      grants: { cash?: number; gems?: number; permanentX2?: boolean }[]
      ledger: string[]
    }

export function applyAction(
  state: GameState,
  action: GameAction,
  content: Content = getContent(state.mapId),
): GameState {
  switch (action.type) {
    case 'upgrade':
      return upgradeEquipment(state, action.id, content)
    case 'upgradeStaff':
      return upgradeStaff(state, action.id, content)
    case 'reward':
      return applyReward(state, action.placement, content, action.amount)
    case 'grant': {
      const s = cloneState(state)
      s.cash += action.cash ?? 0
      s.gems += action.gems ?? 0
      if (action.permanentX2) s.boosts.permanentX2 = true
      return s
    }
    case 'skipUpgradeWithGems':
      return skipUpgradeWithGems(state, action.id)
    case 'applyPurchases': {
      const s = cloneState(state)
      for (const g of action.grants) {
        s.cash += g.cash ?? 0
        s.gems += g.gems ?? 0
        if (g.permanentX2) s.boosts.permanentX2 = true
      }
      s.ledger = action.ledger
      return s
    }
    case 'debugAddCash': {
      const s = cloneState(state)
      s.cash += action.amount
      return s
    }
  }
}

export function findEquipment(state: GameState, id: string) {
  const charger = state.chargers.find((c) => c.id === id)
  if (charger) return { kind: 'charger' as EquipmentKind, item: charger }
  const panel = state.panels.find((p) => p.id === id)
  if (panel) return { kind: 'panelRow' as EquipmentKind, item: panel }
  const battery = state.batteries.find((b) => b.id === id)
  if (battery) return { kind: 'battery' as EquipmentKind, item: battery }
  return null
}

export function upgradeEquipment(state: GameState, id: string, content: Content): GameState {
  const found = findEquipment(state, id)
  if (!found || found.item.upgradingUntil > 0) return state
  const price = nextTierPrice(found.kind, found.item.tier, content)
  if (price === null || state.cash < price) return state
  const s = cloneState(state)
  const item = findEquipment(s, id)!.item
  const tier = content.equipment[found.kind].tiers[found.item.tier + 1]!
  s.cash -= price
  if (tier.buildSeconds > 0) item.upgradingUntil = s.time + tier.buildSeconds
  else item.tier += 1
  s.events = [{ type: 'upgradeDone', id }]
  return s
}

export function upgradeStaff(state: GameState, id: string, content: Content): GameState {
  const member = state.staff.find((m) => m.id === id)
  if (!member) return state
  const price = nextStaffLevelPrice(member.kind, member.level, content)
  if (price === null || state.cash < price) return state
  const s = cloneState(state)
  s.cash -= price
  s.staff.find((m) => m.id === id)!.level += 1
  return s
}

/** Seconds left on the longest running upgrade, for the instant-build offer. */
export function longestUpgrade(state: GameState): { id: string; seconds: number } | null {
  let best: { id: string; seconds: number } | null = null
  for (const item of [...state.chargers, ...state.panels, ...state.batteries]) {
    if (item.upgradingUntil <= 0) continue
    const seconds = item.upgradingUntil - state.time
    if (!best || seconds > best.seconds) best = { id: item.id, seconds }
  }
  return best
}

export function gemsToSkip(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60))
}

function skipUpgradeWithGems(state: GameState, id: string): GameState {
  const found = findEquipment(state, id)
  if (!found || found.item.upgradingUntil <= 0) return state
  const cost = gemsToSkip(found.item.upgradingUntil - state.time)
  if (state.gems < cost) return state
  const s = cloneState(state)
  s.gems -= cost
  findEquipment(s, id)!.item.upgradingUntil = s.time
  return s
}

/** Grants a rewarded-ad placement. `amount` is used by welcome_back (the offline earnings). */
export function applyReward(
  state: GameState,
  placement: RewardPlacement,
  content: Content,
  amount = 0,
): GameState {
  const s = cloneState(state)
  const { boosts } = content.economy
  switch (placement) {
    case 'solar_boost': {
      const from = Math.max(s.time, s.boosts.adIncomeUntil)
      s.boosts.adIncomeUntil = Math.min(
        from + boosts.adBoostSeconds,
        s.time + boosts.adBoostCapSeconds,
      )
      break
    }
    case 'welcome_back':
      s.cash += amount
      s.stats.totalEarned += amount
      break
    case 'instant_build': {
      const longest = longestUpgrade(s)
      if (longest) findEquipment(s, longest.id)!.item.upgradingUntil = s.time
      break
    }
    case 'vip_car': {
      if (s.vipOfferUntil <= s.time) return state
      const rng = new Rng(s.seed)
      const car = spawnCar(s, content.map.vip.type, true, rng, content)
      s.seed = rng.seed
      s.vipOfferUntil = 0
      s.events = [{ type: 'vipArrived', carId: car.id }]
      break
    }
    case 'blackout_rescue':
      s.energy.stored = s.energy.capacity
      break
    case 'daily_chest':
      s.gems += 5
      s.cash += amount
      break
  }
  return s
}

// ---------------------------------------------------------------------------
// Prestige: sell a completed map to the utility for Green Credits.

export function greenCreditsFor(state: GameState, content: Content): number {
  return Math.floor(
    Math.sqrt(state.stats.totalEarned) * content.economy.prestige.creditsPerSqrtEarned,
  )
}

export function incomeLevelPrice(level: number, content: Content): number {
  const p = content.economy.prestige
  return Math.round(p.levelPriceBase * p.levelPriceGrowth ** level)
}

/** Resets the map, awards Green Credits and moves to `nextMapId`. */
export function sellToUtility(state: GameState, nextMapId: string, content: Content): GameState {
  if (!state.mapComplete) return state
  const credits = greenCreditsFor(state, content)
  return createInitialState(nextMapId, {
    seed: state.seed,
    carry: {
      gems: state.gems,
      boosts: state.boosts,
      ledger: state.ledger,
      prestige: {
        ...state.prestige,
        greenCredits: state.prestige.greenCredits + credits,
        mapsCompleted: [...new Set([...state.prestige.mapsCompleted, state.mapId])],
      },
    },
  })
}

/** Spends Green Credits on a permanent income level (carries across maps). */
export function buyIncomeLevel(state: GameState, content: Content): GameState {
  const price = incomeLevelPrice(state.prestige.incomeLevel, content)
  if (state.prestige.greenCredits < price) return state
  const s = cloneState(state)
  s.prestige.greenCredits -= price
  s.prestige.incomeLevel += 1
  return s
}
