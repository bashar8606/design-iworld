// Read-only helpers shared by tick, actions, bots and the UI.
import type {
  BayDef,
  Battery,
  Charger,
  Content,
  GameState,
  MapContent,
  PadDef,
  PanelRow,
  EquipmentKind,
  StaffKind,
  Vec2,
  WindTurbine,
  ZoneDef,
} from './types.ts'
import { dist } from './vec.ts'

export function padDef(content: Content, padId: string): PadDef {
  const pad = content.map.pads.find((p) => p.id === padId)
  if (!pad) throw new Error(`Unknown pad "${padId}"`)
  return pad
}

/** Where a pad's item stands (carports build over the bays, away from their pad). */
export function itemPos(pad: PadDef): Vec2 {
  return pad.buildPos ?? pad.pos
}

/** The first zone is owned from the start; each other zone once its land pad is built. */
export function zoneOwned(state: GameState, map: MapContent, zoneId: string): boolean {
  const land = map.pads.find((p) => p.opensZone === zoneId)
  return !land || !!state.pads[land.id]?.built
}

export function ownedZones(state: GameState, map: MapContent): ZoneDef[] {
  return (map.zones ?? []).filter((z) => zoneOwned(state, map, z.id))
}

export function isPadUnlocked(state: GameState, pad: PadDef, map: MapContent): boolean {
  return (
    (pad.unlockAfter ?? []).every((id) => state.pads[id]?.built) &&
    (!pad.zone || zoneOwned(state, map, pad.zone))
  )
}

/** Pads the player can pay into right now. */
export function openPads(state: GameState, content: Content): PadDef[] {
  return content.map.pads.filter(
    (p) => !state.pads[p.id]?.built && isPadUnlocked(state, p, content.map),
  )
}

/** Bays are laid out for a sedan; longer vehicles stop further back so their nose stays at the post. */
const BAY_LENGTH = 4.6

export function bayStop(bay: BayDef, length: number): Vec2 {
  const back = Math.max(0, length - BAY_LENGTH) / 2
  const dx = bay.post.x - bay.car.x
  const dz = bay.post.z - bay.car.z
  const d = Math.hypot(dx, dz) || 1
  return { x: bay.car.x - (dx / d) * back, z: bay.car.z - (dz / d) * back }
}

export function bayDef(map: MapContent, bayId: string) {
  const bay = map.bays.find((b) => b.id === bayId)
  if (!bay) throw new Error(`Unknown bay "${bayId}"`)
  return bay
}

export function sunIntensity(dayTime: number, map: Pick<MapContent, 'day'>): number {
  const { sunrise, sunset, dawnLength } = map.day
  if (dayTime <= sunrise || dayTime >= sunset) return 0
  const rise = smoothstep((dayTime - sunrise) / dawnLength)
  const set = smoothstep((sunset - dayTime) / dawnLength)
  // A gentle midday peak on top of a long, bright plateau.
  const arc = 0.8 + 0.2 * Math.sin((Math.PI * (dayTime - sunrise)) / (sunset - sunrise))
  return rise * set * arc
}

function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x))
  return t * t * (3 - 2 * t)
}

export function isNight(dayTime: number, map: Pick<MapContent, 'day'>): boolean {
  return dayTime <= map.day.sunrise || dayTime >= map.day.sunset
}

export function dayClock(
  time: number,
  map: Pick<MapContent, 'day'>,
): { day: number; dayTime: number } {
  const total = map.day.startTime + time / map.day.lengthSeconds
  const day = Math.floor(total)
  return { day, dayTime: total - day }
}

export function chargerPowerKw(charger: Charger, content: Content): number {
  return content.equipment.charger.tiers[charger.tier]?.powerKw ?? 0
}

export function turbineRatingKw(turbine: WindTurbine, content: Content): number {
  return content.equipment.windTurbine.tiers[turbine.tier]?.ratingKw ?? 0
}

/** How hard the wind blows, 0..1: a pure function of the clock so ticks stay deterministic. */
export function windStrength(time: number, dayTime: number, map: MapContent): number {
  const w = map.wind
  if (!w) return 0
  const [a, b] = w.periodSeconds
  const gust =
    0.6 * Math.sin((2 * Math.PI * time) / a) + 0.4 * Math.sin((2 * Math.PI * time) / b + 1.3)
  const night = isNight(dayTime, map) ? w.nightBoost : 0
  return Math.min(1, Math.max(0.05, w.base + w.gust * gust + night))
}

export function panelRatingKw(panel: PanelRow, content: Content): number {
  return content.equipment.panelRow.tiers[panel.tier]?.ratingKw ?? 0
}

export function batteryCapacity(batteries: Battery[], content: Content): number {
  return batteries.reduce(
    (sum, b) => sum + (content.equipment.battery.tiers[b.tier]?.capacityKwh ?? 0),
    0,
  )
}

export function batteryPowerKw(batteries: Battery[], content: Content): number {
  return batteries.reduce(
    (sum, b) => sum + (content.equipment.battery.tiers[b.tier]?.powerKw ?? 0),
    0,
  )
}

export function staffSpeedMultiplier(kind: StaffKind, level: number, content: Content): number {
  return 1 + content.equipment.staff[kind].speedPerLevel * level
}

export function prestigeMultiplier(state: GameState, content: Content): number {
  return 1 + content.economy.prestige.incomePerLevel * state.prestige.incomeLevel
}

export function incomeMultiplier(state: GameState, content: Content): number {
  const { boosts } = content.economy
  let m = prestigeMultiplier(state, content)
  if (state.boosts.adIncomeUntil > state.time) m *= boosts.adIncomeMultiplier
  if (state.boosts.permanentX2) m *= boosts.permanentIncomeMultiplier
  return m
}

/** Cars per minute at the current time, before random sampling. */
export function arrivalRate(state: GameState, content: Content): number {
  const { arrivals } = content.map
  const base = arrivals.baseCarsPerMinute + arrivals.perChargerCarsPerMinute * state.chargers.length
  const t = state.dayTime
  // Shortest distance around the day circle to the rush peak.
  const d = Math.min(Math.abs(t - arrivals.rushTime), 1 - Math.abs(t - arrivals.rushTime))
  const rush = arrivals.rushMultiplier * Math.exp(-(d * d) / (2 * arrivals.rushWidth ** 2))
  const night = isNight(t, content.map) ? arrivals.nightMultiplier : 1
  let rate = base * (night + rush)
  const event = activeEvent(state)
  if (event?.kind === 'heatwave' || event?.kind === 'nightRush') {
    rate *= content.events[event.kind].arrivalMultiplier ?? 1
  }
  return rate
}

export function activeEvent(state: GameState) {
  const e = state.event
  return e && state.time >= e.startsAt && state.time < e.endsAt ? e : null
}

/** Distance from a point to a panel row (a segment along x). */
export function distToPanelRow(point: Vec2, center: Vec2, halfLength: number): number {
  const x = Math.max(center.x - halfLength, Math.min(center.x + halfLength, point.x))
  return dist(point, { x, z: center.z })
}

export function clampToBounds(pos: Vec2, map: MapContent): Vec2 {
  return clampToRect(pos, map.bounds)
}

function clampToRect(pos: Vec2, b: ZoneDef['bounds']): Vec2 {
  return {
    x: Math.max(b.minX, Math.min(b.maxX, pos.x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, pos.z)),
  }
}

/** Keeps the player on land they own: inside any owned zone, or pushed to the nearest one. */
export function clampToOwned(pos: Vec2, state: GameState, map: MapContent): Vec2 {
  const zones = ownedZones(state, map)
  if (zones.length === 0) return clampToBounds(pos, map)
  let best = pos
  let bestD = Infinity
  for (const z of zones) {
    const c = clampToRect(pos, z.bounds)
    const d = dist(c, pos)
    if (d === 0) return pos
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  return best
}

/** Price of the next tier for a charger, panel row, battery or turbine, or null at max tier. */
export function nextTierPrice(kind: EquipmentKind, tier: number, content: Content): number | null {
  const next = content.equipment[kind].tiers[tier + 1]
  return next ? next.upgradePrice : null
}

/** Price of the next staff level, or null at max level. */
export function nextStaffLevelPrice(
  kind: StaffKind,
  level: number,
  content: Content,
): number | null {
  return content.equipment.staff[kind].levels[level + 1] ?? null
}

export function builtPadCount(state: GameState): number {
  return Object.values(state.pads).filter((p) => p.built).length
}
