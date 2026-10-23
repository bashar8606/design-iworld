import { Capacitor } from '@capacitor/core'

const params =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()

/**
 * Render settings. On the device: pixel ratio capped at 2 and no real-time shadows (one baked
 * contact shadow plus blob shadows instead). Override with ?shadows=1 or ?shadows=0.
 */
export const STRESS_KEY = 'solar-oasis.stress'

function storedStress(): boolean {
  try {
    return localStorage.getItem(STRESS_KEY) === '1'
  } catch {
    return false
  }
}

export const quality = {
  shadows: params.has('shadows') ? params.get('shadows') !== '0' : !Capacitor.isNativePlatform(),
  maxDpr: 2,
  stress: params.get('stress') === '1' || (typeof window !== 'undefined' && storedStress()),
}
