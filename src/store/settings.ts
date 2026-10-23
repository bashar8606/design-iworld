import { create } from 'zustand'

export interface Settings {
  sound: boolean
  music: boolean
  haptics: boolean
}

const KEY = 'solar-oasis.settings'
const defaults: Settings = { sound: true, music: true, haptics: true }

function load(): Settings {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }
  } catch {
    return defaults
  }
}

/** Per-device preferences (sound, music, haptics). */
export const useSettings = create<Settings & { toggle: (key: keyof Settings) => void }>()(
  (set, get) => ({
    ...load(),
    toggle: (key) => {
      set({ [key]: !get()[key] } as Partial<Settings>)
      try {
        const { sound, music, haptics } = get()
        localStorage.setItem(KEY, JSON.stringify({ sound, music, haptics }))
      } catch {
        // Private mode: settings last for the session.
      }
    },
  }),
)
