import { emptyCollection } from './collection.ts'
import { getContent } from './content.ts'
import { initialMissions } from './missions.ts'
import { Rng } from './rng.ts'
import type { Content, GameState, PadDef } from './types.ts'
import { batteryCapacity, bayDef, dayClock, sunIntensity } from './world.ts'

export const TICKS_PER_SECOND = 10
export const TICK_SECONDS = 1 / TICKS_PER_SECOND
export const SAVE_VERSION = 1
/** A time that never arrives (JSON cannot store Infinity). */
export const NEVER = 1e12

export interface NewGameOptions {
  seed?: number
  /** Carried across maps by the prestige reset. */
  carry?: Pick<GameState, 'prestige' | 'gems' | 'boosts' | 'ledger' | 'collection'>
}

export function createInitialState(mapId = 'map1', options: NewGameOptions = {}): GameState {
  const content = getContent(mapId)
  const { map } = content
  const seed = options.seed ?? 1
  const rng = new Rng(seed)
  const { day, dayTime } = dayClock(0, map)

  const state: GameState = {
    version: SAVE_VERSION,
    mapId,
    seed,
    time: 0,
    day,
    dayTime,
    sun: sunIntensity(dayTime, map),
    cash: map.initial.cash,
    gems: options.carry?.gems ?? 0,
    player: { pos: { ...map.player.start }, heading: 0, moving: false, plug: null },
    pads: Object.fromEntries(map.pads.map((p) => [p.id, { paid: 0, built: false, builtAt: null }])),
    chargers: [],
    panels: [],
    batteries: [],
    turbines: [],
    facilities: { cafe: false, carWash: false },
    staff: [],
    cars: [],
    queue: [],
    pickups: [],
    nextCarId: 1,
    nextPickupId: 1,
    nextArrivalAt: map.arrivals.firstCarDelaySeconds,
    nextVipAt: rng.range(...map.vip.everySeconds),
    energy: { stored: 0, capacity: 0, produced: 0, delivered: 0, batteryFlow: 0, blackout: false },
    event: null,
    eventSchedule: {
      sandstorm: content.events.firstDay + Math.round(rng.range(0, 1)),
      heatwave: content.events.firstDay + 1 + Math.round(rng.range(0, 1)),
      nightRush: content.events.firstDay,
    },
    vipOfferUntil: 0,
    contract: null,
    nextContractAt: map.contracts ? rng.range(...map.contracts.everySeconds) : NEVER,
    boosts: options.carry?.boosts ?? { adIncomeUntil: 0, permanentX2: false },
    prestige: options.carry?.prestige ?? { greenCredits: 0, incomeLevel: 0, mapsCompleted: [] },
    stats: {
      carsServed: 0,
      carsLost: 0,
      carsLostTonight: 0,
      totalEarned: 0,
      energyProduced: 0,
      energyDelivered: 0,
      taxisServed: 0,
    },
    milestones: { firstCashAt: null, firstNightSurvived: null },
    mapComplete: false,
    ledger: options.carry?.ledger ?? null,
    missions: { seq: 0, completed: 0, active: [] },
    collection: options.carry?.collection ?? emptyCollection(),
    events: [],
  }
  // Boost timers are sim-time based; a new map restarts the clock.
  state.boosts = { ...state.boosts, adIncomeUntil: 0 }
  state.seed = rng.seed

  state.missions = initialMissions(state)
  for (const pad of map.pads) {
    if (pad.price === 0) buildPadItem(state, pad, content)
  }
  return state
}

/** Marks a pad built and adds what it builds. Mutates `state` (used inside tick on a copy). */
export function buildPadItem(state: GameState, pad: PadDef, content: Content): void {
  state.pads[pad.id] = { paid: pad.price, built: true, builtAt: state.time }
  switch (pad.kind) {
    case 'charger': {
      const bayId = pad.bay ?? content.map.bays[state.chargers.length]?.id
      if (!bayId) throw new Error(`Charger pad "${pad.id}" has no bay`)
      bayDef(content.map, bayId)
      const tier = Math.min(
        content.map.initial.chargerTier ?? 0,
        content.equipment.charger.tiers.length - 1,
      )
      state.chargers.push({ id: pad.id, bayId, tier, carId: null, upgradingUntil: 0 })
      break
    }
    case 'panelRow':
      state.panels.push({ id: pad.id, tier: 0, dust: 0, upgradingUntil: 0 })
      break
    case 'battery':
      state.batteries.push({ id: pad.id, tier: 0, upgradingUntil: 0 })
      state.energy.capacity = batteryCapacity(state.batteries, content)
      break
    case 'cafe':
      state.facilities.cafe = true
      break
    case 'carWash':
      state.facilities.carWash = true
      break
    case 'windTurbine':
      state.turbines.push({ id: pad.id, tier: 0, upgradingUntil: 0 })
      break
    case 'land':
      // Owning the zone is read from the pad itself (see zoneOwned).
      break
    case 'technician':
    case 'cashier':
    case 'robot':
      state.staff.push({
        id: pad.id,
        kind: pad.kind,
        level: 0,
        pos: { ...pad.pos },
        home: { ...pad.pos },
        target: null,
        timer: 0,
      })
      break
  }
}
