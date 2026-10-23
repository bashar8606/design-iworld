// What can be upgraded, for the upgrade sheet and the nearby-upgrade card.
import type { GameAction } from '../game/actions.ts'
import type { Content, GameState, PadKind, TierDef, Vec2 } from '../game/types.ts'
import {
  bayDef,
  itemPos,
  nextStaffLevelPrice,
  nextTierPrice,
  staffSpeedMultiplier,
} from '../game/world.ts'

export interface UpgradeOption {
  id: string
  kind: PadKind
  title: string
  /** Current level, from 1. */
  level: number
  description: string
  /** What the next level adds, e.g. "+50% Capacity". */
  stats: string[]
  from: string
  to: string | null
  price: number | null
  buildSeconds: number
  upgradingUntil: number
  pos: Vec2
  action: GameAction
}

const STAFF_TITLES = {
  technician: 'Technician',
  cashier: 'Cashier',
  robot: 'Cleaning robot',
} as const

const DESCRIPTIONS: Partial<Record<PadKind, string>> = {
  charger: 'Charge cars faster and serve more of them',
  panelRow: 'Make more power from the same sunshine',
  battery: 'Store more energy for the night',
  technician: 'Plugs in waiting cars faster',
  cashier: 'Collects cash stacks faster',
  robot: 'Keeps the panels free of dust',
}

/** "+50% Capacity" from one tier value to the next. */
function gain(from: number | undefined, to: number | undefined, label: string): string[] {
  if (!from || !to || to <= from) return []
  return [`+${Math.round((to / from - 1) * 100)}% ${label}`]
}

function tierStats(
  kind: 'charger' | 'panelRow' | 'battery',
  from: TierDef,
  to: TierDef | undefined,
): string[] {
  if (!to) return []
  if (kind === 'charger') return gain(from.powerKw, to.powerKw, 'Charge speed')
  if (kind === 'panelRow') return gain(from.ratingKw, to.ratingKw, 'Power')
  return [
    ...gain(from.capacityKwh, to.capacityKwh, 'Capacity'),
    ...gain(from.powerKw, to.powerKw, 'Output'),
  ]
}

export function upgradeOptions(state: GameState, content: Content): UpgradeOption[] {
  const { map, equipment } = content
  const out: UpgradeOption[] = []
  const posOf = (id: string) => {
    const pad = map.pads.find((p) => p.id === id)
    return pad ? itemPos(pad) : { x: 0, z: 0 }
  }
  for (const c of state.chargers) {
    const tiers = equipment.charger.tiers
    out.push({
      id: c.id,
      kind: 'charger',
      title: `Charger ${c.id.replace(/\D/g, '')}`,
      level: c.tier + 1,
      description: DESCRIPTIONS.charger!,
      stats: tierStats('charger', tiers[c.tier]!, tiers[c.tier + 1]),
      from: tiers[c.tier]!.label,
      to: tiers[c.tier + 1]?.label ?? null,
      price: nextTierPrice('charger', c.tier, content),
      buildSeconds: tiers[c.tier + 1]?.buildSeconds ?? 0,
      upgradingUntil: c.upgradingUntil,
      pos: bayDef(map, c.bayId).post,
      action: { type: 'upgrade', id: c.id },
    })
  }
  for (const p of state.panels) {
    const tiers = equipment.panelRow.tiers
    out.push({
      id: p.id,
      kind: 'panelRow',
      title: 'Solar row',
      level: p.tier + 1,
      description: DESCRIPTIONS.panelRow!,
      stats: tierStats('panelRow', tiers[p.tier]!, tiers[p.tier + 1]),
      from: tiers[p.tier]!.label,
      to: tiers[p.tier + 1]?.label ?? null,
      price: nextTierPrice('panelRow', p.tier, content),
      buildSeconds: tiers[p.tier + 1]?.buildSeconds ?? 0,
      upgradingUntil: p.upgradingUntil,
      pos: posOf(p.id),
      action: { type: 'upgrade', id: p.id },
    })
  }
  for (const b of state.batteries) {
    const tiers = equipment.battery.tiers
    out.push({
      id: b.id,
      kind: 'battery',
      title: 'Battery',
      level: b.tier + 1,
      description: DESCRIPTIONS.battery!,
      stats: tierStats('battery', tiers[b.tier]!, tiers[b.tier + 1]),
      from: tiers[b.tier]!.label,
      to: tiers[b.tier + 1]?.label ?? null,
      price: nextTierPrice('battery', b.tier, content),
      buildSeconds: tiers[b.tier + 1]?.buildSeconds ?? 0,
      upgradingUntil: b.upgradingUntil,
      pos: posOf(b.id),
      action: { type: 'upgrade', id: b.id },
    })
  }
  for (const m of state.staff) {
    const price = nextStaffLevelPrice(m.kind, m.level, content)
    const speed = (level: number) => staffSpeedMultiplier(m.kind, level, content)
    out.push({
      id: m.id,
      kind: m.kind,
      title: STAFF_TITLES[m.kind],
      level: m.level + 1,
      description: DESCRIPTIONS[m.kind]!,
      stats: price === null ? [] : gain(speed(m.level), speed(m.level + 1), 'Speed'),
      from: `Speed ${m.level + 1}`,
      to: price === null ? null : `Speed ${m.level + 2}`,
      price,
      buildSeconds: 0,
      upgradingUntil: 0,
      pos: m.home,
      action: { type: 'upgradeStaff', id: m.id },
    })
  }
  return out
}
