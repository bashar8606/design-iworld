import { Preferences } from '@capacitor/preferences'

export interface Storage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Backed by localStorage so saves survive reloads in a desktop browser. Private windows and
 * sandboxed frames can block it; then the game runs without saving instead of failing. */
export const webStorage: Storage = {
  async get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      console.info(`[storage] could not save "${key}" (storage blocked)`)
    }
  },
  async remove(key) {
    try {
      localStorage.removeItem(key)
    } catch {
      // nothing saved, nothing to remove
    }
  },
}

export const nativeStorage: Storage = {
  async get(key) {
    const { value } = await Preferences.get({ key })
    return value
  },
  async set(key, value) {
    await Preferences.set({ key, value })
  },
  async remove(key) {
    await Preferences.remove({ key })
  },
}
