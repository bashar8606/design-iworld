import type { PadKind } from '../game/types.ts'

/** Album card art, by car type ('vip' for the VIP limo). */
export const CAR_ICONS: Record<string, string> = {
  scooter: '🛵',
  hatchback: '🚗',
  sedan: '🚙',
  taxi: '🚕',
  vip: '🚘',
}

export const PAD_ICONS: Record<PadKind, string> = {
  charger: '⚡',
  panelRow: '☀️',
  battery: '🔋',
  cafe: '☕',
  carWash: '🫧',
  technician: '🔧',
  cashier: '💵',
  robot: '🤖',
  land: '🚧',
  windTurbine: '🌬️',
}
