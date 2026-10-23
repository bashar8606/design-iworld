import { Capacitor } from '@capacitor/core'
import { type Ads, webAds } from './ads.ts'
import { type Analytics, webAnalytics } from './analytics.ts'
import { type Haptics, nativeHaptics, webHaptics } from './haptics.ts'
import { type Purchases, webPurchases } from './purchases.ts'
import { type Storage, nativeStorage, webStorage } from './storage.ts'

export type { Ads, Analytics, Haptics, Purchases, Storage }

export interface Platform {
  isNative: boolean
  ads: Ads
  purchases: Purchases
  storage: Storage
  haptics: Haptics
  analytics: Analytics
}

export function createPlatform(): Platform {
  const isNative = Capacitor.isNativePlatform()
  return {
    isNative,
    // Native ads (AdMob), purchases (RevenueCat) and analytics (PostHog) plug in here in
    // later phases; until then the stubs run on the device too.
    ads: webAds,
    purchases: webPurchases,
    analytics: webAnalytics,
    storage: isNative ? nativeStorage : webStorage,
    haptics: isNative ? nativeHaptics : webHaptics,
  }
}

export const platform = createPlatform()
