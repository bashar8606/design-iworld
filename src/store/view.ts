// What the shared parts of the scene (camera, sky, player) need, from whichever business is on
// screen.
import type { BusinessId } from '../game/business.ts'
import { getContent } from '../game/content.ts'
import { getQuarryContent } from '../game/quarry/content.ts'
import type { QuarryPlayer, Rect } from '../game/quarry/types.ts'
import type { MapContent } from '../game/types.ts'
import { activeEvent } from '../game/world.ts'
import { type GameStore, useGame } from './gameStore.ts'

export type SceneTheme = MapContent['theme'] | 'forest'

export interface SceneView {
  business: BusinessId
  player: QuarryPlayer
  prevPlayer: QuarryPlayer
  dayTime: number
  sun: number
  day: MapContent['day']
  bounds: Rect
  theme: SceneTheme
  /** A sandstorm is blowing (station only). */
  storm: boolean
}

export function sceneView(s: GameStore = useGame.getState()): SceneView {
  if (s.business === 'quarry' && s.quarry) {
    const { quarry } = getQuarryContent(s.quarry.quarryId)
    return {
      business: 'quarry',
      player: s.quarry.player,
      prevPlayer: (s.quarryPrev ?? s.quarry).player,
      dayTime: s.quarry.dayTime,
      sun: s.quarry.sun,
      day: quarry.day,
      bounds: quarry.bounds,
      theme: quarry.theme,
      storm: false,
    }
  }
  const { map } = getContent(s.state.mapId)
  return {
    business: 'station',
    player: s.state.player,
    prevPlayer: s.prev.player,
    dayTime: s.state.dayTime,
    sun: s.state.sun,
    day: map.day,
    bounds: map.bounds,
    theme: map.theme,
    storm: activeEvent(s.state)?.kind === 'sandstorm',
  }
}

/** True while the quarry is on screen (a primitive, safe as a zustand selector). */
export const selectQuarryOn = (s: GameStore): boolean => s.business === 'quarry' && !!s.quarry
