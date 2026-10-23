// The device performance test (?stress=1): the full map 1 layout at night with 100 panel rows,
// every pad built, a steady stream of cars and full batteries.
import { getContent, registerMap } from './content.ts'
import { createInitialState } from './state.ts'
import type { GameState, MapContent, PadDef } from './types.ts'

export const STRESS_MAP_ID = 'map1-stress'
export const STRESS_PANEL_ROWS = 100

export function stressMap(base: MapContent): MapContent {
  const panels = base.pads.filter((p) => p.kind === 'panelRow')
  const extra: PadDef[] = []
  // A solar farm south and east of the lot, 10 rows by 10 columns.
  for (let i = 0; extra.length + panels.length < STRESS_PANEL_ROWS; i++) {
    const col = i % 10
    const row = Math.floor(i / 10)
    extra.push({
      id: `stressPanel${i}`,
      kind: 'panelRow',
      label: 'Solar row',
      price: 0,
      pos: { x: 16 + col * 8.6, z: -16 + row * 2.4 },
    })
  }
  return {
    ...base,
    id: STRESS_MAP_ID,
    day: { ...base.day, startTime: 0.9 },
    arrivals: {
      ...base.arrivals,
      baseCarsPerMinute: 50,
      perChargerCarsPerMinute: 4,
      firstCarDelaySeconds: 0,
    },
    pads: [...base.pads.map((p) => ({ ...p, price: 0 })), ...extra],
  }
}

export function createStressState(): GameState {
  registerMap(stressMap(getContent('map1').map))
  const s = createInitialState(STRESS_MAP_ID, { seed: 5 })
  s.energy.stored = s.energy.capacity
  return s
}
