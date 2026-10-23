// What can be upgraded, for the upgrade sheet and the nearby-upgrade card.
import type { GameAction } from '../game/actions.ts'
import type { Content, GameState, Vec2 } from '../game/types.ts'
import { bayDef, nextStaffLevelPrice, nextTierPrice } from '../game/world.ts'

export interface UpgradeOption {
  id: string
  title: string
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

export function upgradeOptions(state: GameState, content: Content): UpgradeOption[] {
  const { map, equipment } = content
  const out: UpgradeOption[] = []
  const pad = (id: string) => map.pads.find((p) => p.id === id)
  for (const c of state.chargers) {
    const tiers = equipment.charger.tiers
    out.push({
      id: c.id,
      title: `Charger ${c.id.replace(/\D/g, '')}`,
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
      title: 'Solar row',
      from: tiers[p.tier]!.label,
      to: tiers[p.tier + 1]?.label ?? null,
      price: nextTierPrice('panelRow', p.tier, content),
      buildSeconds: tiers[p.tier + 1]?.buildSeconds ?? 0,
      upgradingUntil: p.upgradingUntil,
      pos: pad(p.id)?.pos ?? { x: 0, z: 0 },
      action: { type: 'upgrade', id: p.id },
    })
  }
  for (const b of state.batteries) {
    const tiers = equipment.battery.tiers
    out.push({
      id: b.id,
      title: 'Battery',
      from: tiers[b.tier]!.label,
      to: tiers[b.tier + 1]?.label ?? null,
      price: nextTierPrice('battery', b.tier, content),
      buildSeconds: tiers[b.tier + 1]?.buildSeconds ?? 0,
      upgradingUntil: b.upgradingUntil,
      pos: pad(b.id)?.pos ?? { x: 0, z: 0 },
      action: { type: 'upgrade', id: b.id },
    })
  }
  for (const m of state.staff) {
    const price = nextStaffLevelPrice(m.kind, m.level, content)
    out.push({
      id: m.id,
      title: STAFF_TITLES[m.kind],
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
