import carsJson from '../content/cars.json'
import economyJson from '../content/economy.json'
import equipmentJson from '../content/equipment.json'
import eventsJson from '../content/events.json'
import map1Json from '../content/map1.json'
import map2Json from '../content/map2.json'
import type {
  CarTypeDef,
  Content,
  EconomyContent,
  EquipmentContent,
  EventsContent,
  MapContent,
} from './types.ts'

const maps: Record<string, MapContent> = {
  map1: map1Json as unknown as MapContent,
  map2: map2Json as unknown as MapContent,
}

const base = {
  cars: carsJson as unknown as Record<string, CarTypeDef>,
  equipment: equipmentJson as unknown as EquipmentContent,
  events: eventsJson as unknown as EventsContent,
  economy: economyJson as EconomyContent,
}

/** Registers another map (map 2 lives in its own JSON and registers itself). */
export function registerMap(map: MapContent): void {
  maps[map.id] = map
}

export function mapIds(): string[] {
  return Object.keys(maps)
}

/** Maps in play order; selling a completed map moves on to the next one. */
export const MAP_ORDER = ['map1', 'map2']

export function nextMapId(mapId: string): string {
  const i = MAP_ORDER.indexOf(mapId)
  return MAP_ORDER[Math.min(MAP_ORDER.length - 1, i + 1)] ?? mapId
}

let overrides: ContentPatch = {}
const cache = new Map<string, Content>()

/** A partial, deeply nested patch over the bundled content (remote config, tuning). */
export type ContentPatch = { [key: string]: unknown }

export function setContentOverrides(patch: ContentPatch): void {
  overrides = patch
  cache.clear()
}

export function getContent(mapId: string): Content {
  const cached = cache.get(mapId)
  if (cached) return cached
  const map = maps[mapId]
  if (!map) throw new Error(`Unknown map "${mapId}"`)
  const content = applyPatch({ ...base, map }, overrides) as Content
  cache.set(mapId, content)
  return content
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-merges a patch. Keys that do not exist in the target are ignored and values whose type
 * differs from the bundled value are rejected, so a bad remote payload cannot break the game.
 * Arrays of objects with an `id` merge by id (e.g. pads); other arrays replace when same-typed.
 */
export function applyPatch(target: unknown, patch: unknown): unknown {
  if (isObject(target) && isObject(patch)) {
    const out: Record<string, unknown> = { ...target }
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'map' && isObject(value) && 'map' in target) {
        out.map = applyPatch(target.map, value)
        continue
      }
      // A patch for a specific map: { maps: { map1: {...} } } applies only to that map.
      if (key === 'maps' && isObject(value) && isObject(target.map)) {
        const mapPatch = value[String(target.map.id)]
        if (mapPatch) out.map = applyPatch(out.map, mapPatch)
        continue
      }
      if (!(key in target)) continue
      out[key] = applyPatch(target[key], value)
    }
    return out
  }
  if (Array.isArray(target) && Array.isArray(patch)) {
    if (target.every((item) => isObject(item) && 'id' in item)) {
      return target.map((item) => {
        const match = patch.find((p) => isObject(p) && p.id === (item as { id: unknown }).id)
        return match ? applyPatch(item, match) : item
      })
    }
    if (patch.every((item, i) => typeof item === typeof target[i % Math.max(1, target.length)])) {
      return patch
    }
    return target
  }
  if (typeof target === typeof patch && typeof patch === 'number' && Number.isFinite(patch)) {
    return patch
  }
  if (typeof target === typeof patch && typeof patch !== 'number') return patch
  return target
}
