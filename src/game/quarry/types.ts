import type { EconomyContent, GameEvent, MapContent, Vec2 } from '../types.ts'

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type QuarryUpgradeId = 'backpack' | 'crusher'

export interface QuarryUpgradeDef {
  name: string
  icon: string
  /** Where the player stands to pay for the next level. */
  pad: Vec2
  /** Value at each level: rocks carried (backpack) or tons crushed per second (crusher). */
  levels: number[]
  /** prices[i] buys level i + 1. */
  prices: number[]
}

export interface BuyerTypeDef {
  id: string
  name: string
  loadTons: number
  /** Seconds a buyer waits without being loaded before driving off. */
  patienceSeconds: number
  weight: number
  color: string
}

/** A quarry map (src/content/quarry*.json). */
export interface QuarryContent {
  id: string
  name: string
  theme: 'forest'
  /** Opens once this charging map is finished. */
  unlock: { afterMap: string }
  /** Where the player can walk. */
  bounds: Rect
  day: MapContent['day']
  player: {
    start: Vec2
    speed: number
    padRadius: number
    pickupRadius: number
    /** A pad price is paid in this many seconds (or at least minDrainPerSecond). */
    buildSeconds: number
    minDrainPerSecond: number
  }
  site: {
    /** Cleared, levelled ground (everything else is grass and forest). */
    clearing: Rect
    /** Where the pit will be dug: centre and radii of the top bench. */
    pit: { x: number; z: number; rx: number; rz: number }
    cabin: { x: number; z: number; rotation: number }
    sign: Vec2
  }
  mining: {
    /** How close to a face the pickaxe reaches. */
    radius: number
    secondsPerRock: number
    tonsPerRock: number
    /** How close to the hopper the player drops rock. */
    dropRadius: number
    dropSecondsPerRock: number
  }
  /** Rock faces on the top bench. */
  faces: { id: string; pos: Vec2; rocks: number; regenSecondsPerRock: number }[]
  crusher: {
    pos: Vec2
    hopper: Vec2
    hopperTons: number
    /** Seconds crushed rock spends on the conveyor. */
    beltSeconds: number
    beltEnd: Vec2
  }
  stockpiles: { id: string; product: string; pos: Vec2; capacityTons: number }[]
  products: Record<string, { name: string; pricePerTon: number }>
  upgrades: Record<QuarryUpgradeId, QuarryUpgradeDef>
  buyers: {
    firstDelaySeconds: number
    everySeconds: [number, number]
    speed: number
    loadTonsPerSecond: number
    types: BuyerTypeDef[]
    road: {
      /** Buyers drive in along z = road.z from spawnX towards bayX, queueing behind the bay. */
      z: number
      spawnX: number
      bayX: number
      queueSpacing: number
      /** No new buyer turns in while this many are waiting. */
      maxWaiting: number
      /** Waypoints out of the site after loading. */
      exit: Vec2[]
    }
  }
  office: { counter: Vec2 }
  forest: { count: number; seed: number; margin: number; extent: number }
  /** Grassy hills on the horizon. */
  hills: { x: number; z: number; r: number; h: number }[]
  /** Later quarries, shown locked in the map sheet. */
  next: { id: string; name: string }[]
}

export interface QuarryAllContent {
  quarry: QuarryContent
  economy: EconomyContent
}

export interface QuarryPlayer {
  pos: Vec2
  heading: number
  moving: boolean
}

export interface Buyer {
  id: number
  type: string
  pos: Vec2
  heading: number
  /** arriving: driving in or queueing; loading: at the bay; leaving: on the way out. */
  phase: 'arriving' | 'loading' | 'leaving'
  loaded: number
  /** Seconds waited without being loaded. */
  waited: number
  /** Next exit waypoint while leaving. */
  exitStep: number
  /** Drove off without a full load. */
  angry: boolean
}

export interface CashStack {
  id: number
  amount: number
  pos: Vec2
}

/** Everything about one quarry that is saved. */
export interface QuarryState {
  quarryId: string
  seed: number
  /** Simulation seconds since the quarry opened. */
  time: number
  day: number
  dayTime: number
  sun: number
  cash: number
  player: QuarryPlayer & { carry: number }
  /** Rocks left on each face. */
  faces: Record<string, number>
  /** Seconds into mining the next rock / dropping the next one. */
  mineTimer: number
  dropTimer: number
  /** Tons waiting in the crusher's hopper. */
  hopper: number
  /** Crushed batches on the conveyor, landing on the pile at `at`. */
  belt: { tons: number; at: number }[]
  /** Tons on each stockpile. */
  piles: Record<string, number>
  levels: Record<QuarryUpgradeId, number>
  /** Cash paid towards each upgrade's next level. */
  paid: Record<QuarryUpgradeId, number>
  buyers: Buyer[]
  nextBuyerId: number
  nextBuyerAt: number
  stacks: CashStack[]
  nextStackId: number
  stats: {
    rocksMined: number
    tonsCrushed: number
    tonsSold: number
    buyersServed: number
    buyersLost: number
    totalEarned: number
  }
  /** Events of the last tick (sound, effects); never saved. */
  events: GameEvent[]
}
