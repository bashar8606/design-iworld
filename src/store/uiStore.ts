import { create } from 'zustand'

export type Sheet =
  | 'settings'
  | 'upgrades'
  | 'shop'
  | 'debug'
  | 'credits'
  | 'feedback'
  | 'greenCredits'
  | 'missions'
  | 'map'
  | null

export interface UiStore {
  sheet: Sheet
  /** "While you were away" card. */
  offline: { earned: number; seconds: number } | null
  /** Set once the save has loaded (or there was none). */
  loaded: boolean
  open: (sheet: Sheet) => void
  showOffline: (earned: number, seconds: number) => void
  dismissOffline: () => void
  setLoaded: () => void
}

export const useUi = create<UiStore>()((set) => ({
  sheet: null,
  offline: null,
  loaded: false,
  open: (sheet) => set({ sheet }),
  showOffline: (earned, seconds) => set({ offline: { earned, seconds } }),
  dismissOffline: () => set({ offline: null }),
  setLoaded: () => set({ loaded: true }),
}))
