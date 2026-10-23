import { Preferences } from '@capacitor/preferences'

export interface Storage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Backed by localStorage so saves survive reloads in a desktop browser. */
export const webStorage: Storage = {
  async get(key) {
    console.info(`[storage] get "${key}" (web)`)
    return localStorage.getItem(key)
  },
  async set(key, value) {
    console.info(`[storage] set "${key}" (${value.length} chars, web)`)
    localStorage.setItem(key, value)
  },
  async remove(key) {
    console.info(`[storage] remove "${key}" (web)`)
    localStorage.removeItem(key)
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
