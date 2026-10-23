import type { EconomyContent, MapContent, Vec2 } from '../types.ts'

export interface Rect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
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
  player: { start: Vec2; speed: number }
  site: {
    /** Cleared, levelled ground (everything else is grass and forest). */
    clearing: Rect
    /** Where the pit will be dug: centre and radii of the top bench. */
    pit: { x: number; z: number; rx: number; rz: number }
    cabin: { x: number; z: number; rotation: number }
    sign: Vec2
  }
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

/** Everything about one quarry that is saved. */
export interface QuarryState {
  quarryId: string
  /** Simulation seconds since the quarry opened. */
  time: number
  day: number
  dayTime: number
  sun: number
  cash: number
  player: QuarryPlayer
}
