// Live tuning: balance values (prices, rates, ad caps) from a PostHog feature-flag payload.
// Bundled values stay in place when offline, and a bad payload can never break a save.
import { type ContentPatch, setContentOverrides } from '../game/content.ts'
import { platform } from '../platform/index.ts'
import { trackUi } from './tracking.ts'

export const REMOTE_CONFIG_FLAG = 'balance'

const ALLOWED_TOP_LEVEL = new Set(['economy', 'cars', 'equipment', 'events', 'maps'])
/** Keys that must never be changed remotely: they would move things the save points at. */
const FROZEN_KEYS = new Set([
  'id',
  'pos',
  'bay',
  'bays',
  'bounds',
  'road',
  'lane',
  'queueSlots',
  'unlockAfter',
  'kind',
])

/**
 * Keeps only finite, non-negative numbers, booleans and strings under known sections, and drops
 * anything that would change the map's shape. Returns null when nothing usable is left.
 */
export function sanitizePatch(payload: unknown): ContentPatch | null {
  const clean = (value: unknown, depth: number): unknown => {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined
    if (typeof value === 'boolean' || typeof value === 'string') return value
    if (Array.isArray(value)) {
      const items = value.map((v) => clean(v, depth + 1))
      return items.every((v) => v !== undefined) ? items : undefined
    }
    if (typeof value === 'object' && value !== null && depth < 8) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        if (FROZEN_KEYS.has(k) && k !== 'id') continue
        const c = clean(v, depth + 1)
        if (c !== undefined) out[k] = c
      }
      return Object.keys(out).length > 0 ? out : undefined
    }
    return undefined
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const patch: ContentPatch = {}
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) continue
    const c = clean(value, 0)
    if (c !== undefined) patch[key] = c
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/** Fetches and applies remote balance values; returns true when a patch was applied. */
export async function loadRemoteConfig(): Promise<boolean> {
  try {
    const payload = await platform.analytics.remoteConfig(REMOTE_CONFIG_FLAG)
    const patch = sanitizePatch(typeof payload === 'string' ? JSON.parse(payload) : payload)
    if (!patch) return false
    setContentOverrides(patch)
    trackUi('remote_config_applied', { keys: Object.keys(patch).join(',') })
    return true
  } catch (e) {
    console.warn('[remote config] ignored', e)
    return false
  }
}
