// Bot players: the balancing simulation's greedy, smart and idle strategies, and the store demo's
// autopilot. They drive the real game code: movement input and the same actions the UI dispatches.
import { type GameAction, applyAction } from './actions.ts'
import { buildPadItem } from './state.ts'
import { NO_INPUT, cloneState, tick } from './tick.ts'
import type { Content, EquipmentKind, GameState, TickInput, Vec2 } from './types.ts'
import { dist } from './vec.ts'
import { bayDef, nextStaffLevelPrice, nextTierPrice, openPads } from './world.ts'

export type Strategy = 'greedy' | 'smart' | 'idle'

export interface Purchase {
  kind: 'pad' | 'upgrade' | 'staff'
  id: string
  price: number
  /** Where to stand for a pad purchase. */
  pos?: Vec2
}

/** Everything the bot could buy next. */
export function purchaseOptions(state: GameState, content: Content): Purchase[] {
  const out: Purchase[] = openPads(state, content).map((p) => ({
    kind: 'pad',
    id: p.id,
    price: p.price - (state.pads[p.id]?.paid ?? 0),
    pos: p.pos,
  }))
  const equipment: [string, EquipmentKind, number, number][] = [
    ...state.chargers.map(
      (c) => [c.id, 'charger', c.tier, c.upgradingUntil] as [string, 'charger', number, number],
    ),
    ...state.panels.map(
      (p) => [p.id, 'panelRow', p.tier, p.upgradingUntil] as [string, 'panelRow', number, number],
    ),
    ...state.batteries.map(
      (b) => [b.id, 'battery', b.tier, b.upgradingUntil] as [string, 'battery', number, number],
    ),
    ...state.turbines.map(
      (t) =>
        [t.id, 'windTurbine', t.tier, t.upgradingUntil] as [string, 'windTurbine', number, number],
    ),
  ]
  for (const [id, kind, tier, upgrading] of equipment) {
    if (upgrading > 0) continue
    const price = nextTierPrice(kind, tier, content)
    if (price !== null) out.push({ kind: 'upgrade', id, price })
  }
  for (const m of state.staff) {
    const price = nextStaffLevelPrice(m.kind, m.level, content)
    if (price !== null) out.push({ kind: 'staff', id: m.id, price })
  }
  return out
}

/** Applies a purchase instantly (used by the smart bot's look-ahead). */
function applyPurchase(state: GameState, p: Purchase, content: Content): GameState {
  if (p.kind === 'pad') {
    const s = cloneState(state)
    buildPadItem(
      s,
      content.map.pads.find((x) => x.id === p.id)!,
      content,
    )
    return s
  }
  const s = { ...state, cash: state.cash + p.price }
  const action: GameAction =
    p.kind === 'upgrade' ? { type: 'upgrade', id: p.id } : { type: 'upgradeStaff', id: p.id }
  const next = applyAction(s, action, content)
  // Finish timed upgrades straight away for the estimate.
  const done = <T extends { upgradingUntil: number }>(items: T[]) =>
    items.map((i) => (i.upgradingUntil ? { ...i, upgradingUntil: next.time } : i))
  return {
    ...next,
    chargers: done(next.chargers),
    panels: done(next.panels),
    batteries: done(next.batteries),
    turbines: done(next.turbines),
  }
}

function steer(from: Vec2, to: Vec2): TickInput {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const d = Math.hypot(dx, dz)
  return d < 0.25 ? NO_INPUT : { move: { x: dx / d, z: dz / d } }
}

export interface BotOptions {
  strategy: Strategy
  /** Share of time spent playing vs offline, used to weigh the look-ahead. */
  activeShare: number
}

export class Bot {
  plan: Purchase | null = null
  private planAt = -Infinity
  readonly options: BotOptions

  constructor(options: BotOptions) {
    this.options = options
  }

  /** Chooses movement and any instant purchases for this tick. */
  decide(state: GameState, content: Content): { input: TickInput; actions: GameAction[] } {
    const { map } = content
    const actions: GameAction[] = []
    const me = state.player.pos

    // Re-plan when nothing is chosen, the choice is gone, or every 20 s of play.
    if (!this.plan || state.time - this.planAt > 20 || !this.stillAvailable(state, content)) {
      this.plan = this.choose(state, content)
      this.planAt = state.time
    }
    const plan = this.plan
    if (plan && plan.kind !== 'pad' && state.cash >= plan.price) {
      actions.push(
        plan.kind === 'upgrade'
          ? { type: 'upgrade', id: plan.id }
          : { type: 'upgradeStaff', id: plan.id },
      )
      this.plan = null
    }

    // 1. Plug in waiting cars that no technician is already walking to.
    const techTargets = new Set(
      state.staff
        .filter((m) => m.target?.kind === 'bay')
        .map((m) => (m.target as { id: string }).id),
    )
    let goal: Vec2 | null = null
    let best = Infinity
    for (const c of state.chargers) {
      const car = state.cars.find((x) => x.id === c.carId)
      if (car?.phase !== 'waiting' || techTargets.has(c.bayId)) continue
      const post = bayDef(map, c.bayId).post
      const d = dist(me, post)
      if (d < best) {
        best = d
        goal = post
      }
    }
    // 2. Collect cash stacks (unless a cashier has it covered).
    const hasCashier = state.staff.some((m) => m.kind === 'cashier')
    if (!goal && (!hasCashier || state.pickups.length > 3)) {
      for (const p of state.pickups) {
        const d = dist(me, p.pos)
        if (d < best) {
          best = d
          goal = p.pos
        }
      }
    }
    // 3. Walk onto the chosen pad once it is affordable.
    if (!goal && plan?.kind === 'pad' && state.cash >= plan.price && plan.pos) goal = plan.pos
    // 4. Wipe dusty panels when there is no robot.
    if (!goal && !state.staff.some((m) => m.kind === 'robot')) {
      const dusty = state.panels.find((p) => p.dust > 0.35)
      if (dusty) {
        const pad = map.pads.find((p) => p.id === dusty.id)!
        goal = { x: pad.pos.x, z: pad.pos.z + 1 }
      }
    }
    // 5. Wait by the chargers.
    goal ??= { x: map.bays[0]!.post.x + 0.8, z: (map.bays[0]!.post.z + map.bays[1]!.post.z) / 2 }
    return { input: steer(me, goal), actions }
  }

  private stillAvailable(state: GameState, content: Content): boolean {
    const p = this.plan
    if (!p) return false
    return purchaseOptions(state, content).some((o) => o.kind === p.kind && o.id === p.id)
  }

  choose(state: GameState, content: Content): Purchase | null {
    const options = purchaseOptions(state, content).sort((a, b) => a.price - b.price)
    if (options.length === 0) return null
    if (this.options.strategy === 'greedy') return options[0]!
    // Smart and idle: estimate income gained per unit of cash with a short look-ahead.
    const candidates = options.slice(0, 6)
    const base = lookAhead(state, content, this.options.activeShare)
    let best = candidates[0]!
    let bestScore = -Infinity
    for (const c of candidates) {
      const gain =
        lookAhead(applyPurchase(state, c, content), content, this.options.activeShare) - base
      // Cheap items win ties; a purchase with no visible gain still beats saving forever.
      const score = (Math.max(0, gain) + 0.01) / Math.max(1, c.price)
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    return best
  }
}

/** Income per minute over a short window: part played by a simple autopilot, part offline. */
function lookAhead(state: GameState, content: Content, activeShare: number): number {
  const autopilot = new Bot({ strategy: 'greedy', activeShare })
  autopilot.plan = null
  let s: GameState = { ...state, cash: 0, events: [] }
  const activeSeconds = 120
  const start = s.stats.totalEarned
  for (let t = 0; t < activeSeconds; t += 0.25) {
    const { input } = autopilot.decide({ ...s, cash: 0 }, content)
    s = tick(s, 0.25, input, {}, content)
  }
  const active = ((s.stats.totalEarned - start) / activeSeconds) * 60
  let o: GameState = { ...state, cash: 0, events: [] }
  const offlineSeconds = 600
  const startOffline = o.stats.totalEarned
  for (let t = 0; t < offlineSeconds; t += 1) o = tick(o, 1, NO_INPUT, { offline: true }, content)
  const offline = ((o.stats.totalEarned - startOffline) / offlineSeconds) * 60
  return active * activeShare + offline * (1 - activeShare)
}
