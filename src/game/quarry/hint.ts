import type { Vec2 } from '../types.ts'
import { dist } from '../vec.ts'
import { backpackCapacity, nextUpgradePrice } from './state.ts'
import type { QuarryContent, QuarryState, QuarryUpgradeId } from './types.ts'

export interface QuarryHint {
  text: string
  /** Where the arrow points, or null for no arrow. */
  target: Vec2 | null
}

/**
 * The next thing to do in the quarry, for the hint line and the arrow. Pure, so it is the same
 * in tests and on screen.
 */
export function quarryHint(s: QuarryState, quarry: QuarryContent): QuarryHint {
  // An affordable upgrade comes first, so the arrow never flips between it and the counter.
  for (const id of ['crusher', 'backpack'] as QuarryUpgradeId[]) {
    const price = nextUpgradePrice(s, quarry, id)
    if (price !== null && s.cash + s.paid[id] >= price) {
      const name = quarry.upgrades[id].name.toLowerCase()
      return { text: `Upgrade the ${name}: stand on the pad`, target: quarry.upgrades[id].pad }
    }
  }
  const stack = s.stacks[0]
  if (stack && stack.amount >= 1)
    return { text: 'Collect the cash at the office counter', target: stack.pos }
  const cap = backpackCapacity(s, quarry)
  const hopperRoom = s.hopper + quarry.mining.tonsPerRock <= quarry.crusher.hopperTons + 1e-9
  if (s.player.carry >= cap || (s.player.carry > 0 && hopperRoom && nearHopper(s, quarry)))
    return { text: 'Carry the rock to the crusher hopper', target: quarry.crusher.hopper }
  const face = quarry.faces
    .filter((f) => (s.faces[f.id] ?? 0) >= 1)
    .sort((a, b) => dist(a.pos, s.player.pos) - dist(b.pos, s.player.pos))[0]
  if (face)
    return {
      text:
        s.player.carry > 0 ? 'Mine more rock, then fill the hopper' : 'Mine rock at a rock face',
      target: face.pos,
    }
  return { text: 'The faces are growing back: wait a moment', target: null }
}

function nearHopper(s: QuarryState, quarry: QuarryContent): boolean {
  return dist(s.player.pos, quarry.crusher.hopper) <= quarry.mining.dropRadius
}
