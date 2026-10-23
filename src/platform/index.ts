import { Capacitor } from '@capacitor/core'
import { type Ads, webAds } from './ads.ts'
import { type Analytics, createPostHogAnalytics, webAnalytics } from './analytics.ts'
import { type Haptics, nativeHaptics, webHaptics } from './haptics.ts'
import { type Lifecycle, nativeLifecycle, webLifecycle } from './lifecycle.ts'
import { type Purchases, webPurchases } from './purchases.ts'
import { type Storage, nativeStorage, webStorage } from './storage.ts'

export type { Ads, Analytics, Haptics, Lifecycle, Purchases, Storage }

export interface Platform {
  isNative: boolean
  ads: Ads
  purchases: Purchases
  storage: Storage
  haptics: Haptics
  analytics: Analytics
  lifecycle: Lifecycle
}

const postHogKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const postHogHost =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com'

export function createPlatform(): Platform {
  const isNative = Capacitor.isNativePlatform()
  return {
    isNative,
    // Native ads (AdMob) and purchases (RevenueCat) plug in here in Phase 6.
    ads: webAds,
    purchases: webPurchases,
    analytics: postHogKey ? createPostHogAnalytics(postHogKey, postHogHost) : webAnalytics,
    storage: isNative ? nativeStorage : webStorage,
    haptics: isNative ? nativeHaptics : webHaptics,
    lifecycle: isNative ? nativeLifecycle : webLifecycle,
  }
}

export const platform = createPlatform()
