// Shared types for the simulation. Content types mirror src/content/*.json.

export interface Vec2 {
  x: number
  z: number
}

export type PadKind =
  | 'charger'
  | 'panelRow'
  | 'battery'
  | 'cafe'
  | 'carWash'
  | 'technician'
  | 'cashier'
  | 'robot'
  | 'land'

export type StaffKind = 'technician' | 'cashier' | 'robot'
export type EquipmentKind = 'charger' | 'panelRow' | 'battery'

export interface PadDef {
  id: string
  kind: PadKind
  label: string
  price: number
  pos: Vec2
  /** Pads that must be built before this one appears. */
  unlockAfter?: string[]
  /** Charger pads: the parking bay the charger serves. */
  bay?: string
  /** Height of the pad above the ground. */
  y?: number
  /** Where the built item stands, when not on the pad itself (carports over the bays). */
  buildPos?: Vec2
  /** Height the item is built at (carports and roof decks build upward). */
  buildY?: number
  /** The zone the pad stands in; it opens only once that zone is owned. */
  zone?: string
  /** Land pads: the zone this pad buys. */
  opensZone?: string
}

/** A piece of the lot the player buys with a land pad (the first zone is owned from the start). */
export interface ZoneDef {
  id: string
  name: string
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export interface BayDef {
  id: string
  car: Vec2
  post: Vec2
}

export interface CarTypeWeight {
  weight: number
  unlockAfter?: string
}

export interface MapContent {
  id: string
  name: string
  /** Visual setting for the scene. */
  theme: 'desert' | 'city'
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  day: {
    lengthSeconds: number
    sunrise: number
    sunset: number
    /** Fraction of a day the sun takes to rise or set fully. */
    dawnLength: number
    startTime: number
  }
  energy: { kwhPerKwSecond: number }
  player: {
    start: Vec2
    speed: number
    plugSeconds: number
    plugRadius: number
    pickupRadius: number
    padRadius: number
    cleanRadius: number
    cleanPerSecond: number
    /** Seconds of standing on a pad to pay its full price (bounded by minDrainPerSecond). */
    buildSeconds: number
    minDrainPerSecond: number
  }
  road: {
    laneX: number
    spawnZ: number
    despawnZ: number
    entranceZ: number
    exitZ: number
    carSpeed: number
  }
  lane: { x: number; entryZ: number; exitZ: number }
  queueSlots: Vec2[]
  bays: BayDef[]
  arrivals: {
    baseCarsPerMinute: number
    perChargerCarsPerMinute: number
    nightMultiplier: number
    rushTime: number
    rushWidth: number
    rushMultiplier: number
    firstCarDelaySeconds: number
  }
  dust: { perSecond: number; maxOutputLoss: number }
  spending: {
    minDwellSeconds: number
    cafePerMinute: number
    carWashPerMinute: number
    maxDwellBonusSeconds: number
  }
  carTypes: Record<string, CarTypeWeight>
  vip: { everySeconds: [number, number]; offerSeconds: number; payMultiplier: number; type: string }
  panelRow: { halfLength: number }
  /** Distance along +x from a charger post to its cash stack. */
  cashStackOffset: number
  /** Map 2: taxi fleet contracts. */
  contracts?: {
    everySeconds: [number, number]
    taxis: [number, number]
    durationSeconds: number
    bonusPerTaxi: number
  }
  pads: PadDef[]
  /** The lot in pieces; maps without zones are all open from the start. */
  zones?: ZoneDef[]
  initial: { cash: number; firstCarType?: string; chargerTier?: number }
}

export interface CarTypeDef {
  model: string
  energyKwh: [number, number]
  pricePerKwh: number
  patienceSeconds: number
  speed: number
  length: number
}

export interface TierDef {
  id: string
  label: string
  upgradePrice: number
  buildSeconds: number
  powerKw?: number
  ratingKw?: number
  capacityKwh?: number
}

export interface StaffDef {
  speed: number
  taskSeconds: number
  /** Price of each level; index 0 is the hire level (paid through the pad). */
  levels: number[]
  speedPerLevel: number
  cleanPerSecond?: number
}

export interface EquipmentContent {
  charger: { tiers: TierDef[] }
  panelRow: { tiers: TierDef[] }
  battery: { tiers: TierDef[] }
  staff: Record<StaffKind, StaffDef>
}

export interface EventDef {
  everyDays: [number, number]
  dayTime: number
  durationSeconds: number
  announceSeconds: number
  panelOutputMultiplier?: number
  dustMultiplier?: number
  arrivalMultiplier?: number
  enabled?: boolean
}

export interface EventsContent {
  firstDay: number
  sandstorm: EventDef
  heatwave: EventDef
  /** Busier late evenings (a Ramadan live event); off unless remote config enables it. */
  nightRush: EventDef
}

export interface EconomyContent {
  offline: {
    capSeconds: number
    efficiency: number
    stepSeconds: number
    minSecondsForCard: number
  }
  boosts: {
    adIncomeMultiplier: number
    adBoostSeconds: number
    adBoostCapSeconds: number
    permanentIncomeMultiplier: number
  }
  milestones: { nightSurvivedMaxLost: number }
  save: { autosaveSeconds: number }
  prestige: {
    creditsPerSqrtEarned: number
    incomePerLevel: number
    levelPriceBase: number
    levelPriceGrowth: number
  }
}

export interface Content {
  map: MapContent
  cars: Record<string, CarTypeDef>
  equipment: EquipmentContent
  events: EventsContent
  economy: EconomyContent
}

// ---------------------------------------------------------------------------
// State

export type CarPhase =
  'approach' | 'queue' | 'toBay' | 'waiting' | 'charging' | 'leaving' | 'angry' | 'passing'

export interface Car {
  id: number
  type: string
  vip: boolean
  phase: CarPhase
  pos: Vec2
  heading: number
  /** Remaining waypoints. */
  path: Vec2[]
  /** Drives backwards along the current path (leaving a bay). */
  reversing: boolean
  speed: number
  energyNeeded: number
  energyDelivered: number
  patience: number
  patienceMax: number
  /** Seconds since the car joined the queue. */
  dwell: number
  bayId: string | null
}

export interface Charger {
  id: string
  bayId: string
  tier: number
  carId: number | null
  /** Sim time when an upgrade finishes, or 0. */
  upgradingUntil: number
}

export interface PanelRow {
  id: string
  tier: number
  dust: number
  upgradingUntil: number
}

export interface Battery {
  id: string
  tier: number
  upgradingUntil: number
}

export interface Staff {
  id: string
  kind: StaffKind
  level: number
  pos: Vec2
  home: Vec2
  /** What the staff member is walking to or working on. */
  target:
    | { kind: 'bay'; id: string }
    | { kind: 'pickup'; id: number }
    | { kind: 'panel'; id: string }
    | null
  timer: number
}

export interface Pickup {
  id: number
  pos: Vec2
  amount: number
  /** Bay the stack belongs to; payments at the same bay pile onto one stack. */
  bayId: string | null
}

export type WorldEventKind = 'sandstorm' | 'heatwave' | 'nightRush'

export interface ActiveEvent {
  kind: WorldEventKind
  announceAt: number
  startsAt: number
  endsAt: number
}

export interface Contract {
  taxisRequired: number
  taxisServed: number
  endsAt: number
  bonus: number
}

export type GameEvent =
  | { type: 'carArrived'; carId: number }
  | { type: 'carPlugged'; carId: number; by: 'player' | 'staff' }
  /** `cafe` and `carWash` are the parts of `amount` the driver spent while waiting. */
  | { type: 'carPaid'; carId: number; amount: number; pos: Vec2; cafe: number; carWash: number }
  | { type: 'carLost'; carId: number }
  | { type: 'cashCollected'; amount: number; pos: Vec2; by: 'player' | 'staff' }
  | { type: 'padBuilt'; padId: string; kind: PadKind; pos: Vec2 }
  | { type: 'upgradeDone'; id: string }
  | { type: 'nightStarted'; day: number }
  | { type: 'dayStarted'; day: number; survived: boolean }
  | { type: 'eventAnnounced'; kind: ActiveEvent['kind'] }
  | { type: 'eventStarted'; kind: ActiveEvent['kind'] }
  | { type: 'eventEnded'; kind: ActiveEvent['kind'] }
  | { type: 'vipArrived'; carId: number }
  | { type: 'contractDone'; bonus: number }
  | { type: 'contractFailed' }
  | { type: 'mapComplete' }

export type MissionKind =
  'serveCars' | 'collectCash' | 'buildPads' | 'surviveNight' | 'upgrade' | 'serveTaxis'

export interface Mission {
  id: string
  kind: MissionKind
  /** With {n} standing for the target. */
  title: string
  target: number
  progress: number
  rewardGems: number
  rewardCash: number
}

export interface GameState {
  version: number
  mapId: string
  seed: number
  /** Simulated seconds since the map started. */
  time: number
  /** Fraction of the current day, 0..1. */
  dayTime: number
  day: number
  sun: number
  cash: number
  gems: number
  player: {
    pos: Vec2
    heading: number
    moving: boolean
    plug: { bayId: string; progress: number } | null
  }
  pads: Record<string, { paid: number; built: boolean; builtAt: number | null }>
  chargers: Charger[]
  panels: PanelRow[]
  batteries: Battery[]
  facilities: { cafe: boolean; carWash: boolean }
  staff: Staff[]
  cars: Car[]
  queue: number[]
  pickups: Pickup[]
  nextCarId: number
  nextPickupId: number
  nextArrivalAt: number
  nextVipAt: number
  energy: {
    stored: number
    capacity: number
    /** kW flowing this tick, for the HUD energy bar. */
    produced: number
    delivered: number
    batteryFlow: number
    blackout: boolean
  }
  event: ActiveEvent | null
  /** Day number on which each event kind next runs. */
  eventSchedule: Record<ActiveEvent['kind'], number>
  /** A VIP car is waiting on the highway until this time (claimed with a rewarded ad). */
  vipOfferUntil: number
  contract: Contract | null
  nextContractAt: number
  boosts: { adIncomeUntil: number; permanentX2: boolean }
  prestige: { greenCredits: number; incomeLevel: number; mapsCompleted: string[] }
  stats: {
    carsServed: number
    carsLost: number
    carsLostTonight: number
    totalEarned: number
    energyProduced: number
    energyDelivered: number
    taxisServed: number
  }
  milestones: {
    firstCashAt: number | null
    firstNightSurvived: boolean | null
  }
  mapComplete: boolean
  /**
   * Store transaction ids already granted, saved with the game so a grant and its ledger entry
   * are written together. null until this install first checks its purchases.
   */
  ledger: string[] | null
  missions: { seq: number; completed: number; active: Mission[] }
  /** Events produced by the last tick(s); the store drains them. */
  events: GameEvent[]
}

export interface TickInput {
  /** Joystick vector, length 0..1, in world x/z. */
  move: Vec2
}

export interface TickOptions {
  /** Offline fast-forward: earnings scaled, pickups auto-collected, no player. */
  offline?: boolean
}
