import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob'
import adsConfig from '../content/ads.json'

export type AdPlacement =
  'solar_boost' | 'welcome_back' | 'instant_build' | 'vip_car' | 'blackout_rescue' | 'daily_chest'

export type AdEvent = 'requested' | 'loaded' | 'shown' | 'rewarded' | 'failed' | 'dismissed'

export interface AdsInitOptions {
  /** Apple's tracking prompt only after the player's first session has ended. */
  allowTrackingPrompt: boolean
  /** Google test ads (development builds). */
  testing: boolean
}

export interface Ads {
  init(options: AdsInitOptions): Promise<void>
  /** Loads a rewarded ad for this placement, replacing any other loaded one. */
  prepareRewarded(placement: AdPlacement): Promise<void>
  /** The placement whose rewarded ad is loaded and ready, if any. */
  readyPlacement(): AdPlacement | null
  /** Resolves true only when the player watched to the end and earned the reward. */
  showRewarded(placement: AdPlacement): Promise<boolean>
  prepareInterstitial(): Promise<void>
  interstitialReady(): boolean
  showInterstitial(): Promise<boolean>
  /** Called on every ad event, for analytics and the UI. */
  onEvent(listener: (event: AdEvent, placement: AdPlacement | 'interstitial') => void): () => void
}

function emitter() {
  const listeners = new Set<(e: AdEvent, p: AdPlacement | 'interstitial') => void>()
  return {
    on(l: (e: AdEvent, p: AdPlacement | 'interstitial') => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    emit(e: AdEvent, p: AdPlacement | 'interstitial') {
      for (const l of listeners) l(e, p)
    },
  }
}

// ---------------------------------------------------------------------------
// Web stub: a short fake ad so flows can be tried in a browser.

function fakeAd(label: string, seconds: number): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement('div')
    el.className = 'fake-ad'
    el.innerHTML = `<div>Test ad<br><small>${label}</small></div>`
    document.body.appendChild(el)
    setTimeout(() => {
      el.remove()
      resolve()
    }, seconds * 1000)
  })
}

export function createWebAds(): Ads {
  const events = emitter()
  let ready: AdPlacement | null = null
  let interstitial = false
  return {
    async init() {
      console.info('[ads] init (web stub)')
    },
    async prepareRewarded(placement) {
      events.emit('requested', placement)
      ready = null
      await new Promise((r) => setTimeout(r, 400))
      ready = placement
      events.emit('loaded', placement)
    },
    readyPlacement: () => ready,
    async showRewarded(placement) {
      if (ready !== placement) {
        events.emit('failed', placement)
        return false
      }
      ready = null
      events.emit('shown', placement)
      await fakeAd(placement, 1.5)
      events.emit('rewarded', placement)
      events.emit('dismissed', placement)
      return true
    },
    async prepareInterstitial() {
      events.emit('requested', 'interstitial')
      interstitial = true
      events.emit('loaded', 'interstitial')
    },
    interstitialReady: () => interstitial,
    async showInterstitial() {
      if (!interstitial) return false
      interstitial = false
      events.emit('shown', 'interstitial')
      await fakeAd('interstitial', 1)
      events.emit('dismissed', 'interstitial')
      return true
    },
    onEvent: (l) => events.on(l),
  }
}

// ---------------------------------------------------------------------------
// AdMob on iOS (@capacitor-community/admob).

export function createAdMobAds(): Ads {
  const events = emitter()
  let testing = true
  let ready: AdPlacement | null = null
  let loading: AdPlacement | null = null
  let interstitial = false
  // Set by the plugin's Rewarded event while an ad is on screen.
  let earnedDuringShow = false
  const unitFor = (placement: AdPlacement | 'interstitial') => {
    const ids = adsConfig.ios
    const id = placement === 'interstitial' ? ids.interstitial : ids.placements[placement]
    if (testing || !id)
      return placement === 'interstitial'
        ? adsConfig.testIds.interstitial
        : adsConfig.testIds.rewarded
    return id
  }

  return {
    async init(options) {
      testing = options.testing
      // 1. Google's User Messaging Platform consent (GDPR and US states).
      try {
        const info = await AdMob.requestConsentInfo()
        if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
          await AdMob.showConsentForm()
        }
      } catch (e) {
        console.warn('[ads] consent', e)
      }
      // 2. Apple's tracking prompt, never on the first launch and never rewarded.
      if (options.allowTrackingPrompt) {
        try {
          const { status } = await AdMob.trackingAuthorizationStatus()
          if (status === 'notDetermined') await AdMob.requestTrackingAuthorization()
        } catch (e) {
          console.warn('[ads] tracking', e)
        }
      }
      // 3. Then AdMob itself.
      await AdMob.initialize({
        initializeForTesting: options.testing,
        maxAdContentRating: MaxAdContentRating.General,
      })
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earnedDuringShow = true
      })
      await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        if (loading) events.emit('failed', loading)
        loading = null
      })
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
        interstitial = false
        events.emit('failed', 'interstitial')
      })
    },
    async prepareRewarded(placement) {
      if (ready === placement || loading === placement) return
      ready = null
      loading = placement
      events.emit('requested', placement)
      try {
        await AdMob.prepareRewardVideoAd({ adId: unitFor(placement), isTesting: testing })
        if (loading === placement) {
          ready = placement
          loading = null
          events.emit('loaded', placement)
        }
      } catch {
        if (loading === placement) loading = null
        events.emit('failed', placement)
      }
    },
    readyPlacement: () => ready,
    async showRewarded(placement) {
      if (ready !== placement) return false
      ready = null
      earnedDuringShow = false
      try {
        events.emit('shown', placement)
        const reward = await AdMob.showRewardVideoAd()
        const earned = earnedDuringShow || (!!reward && reward.amount > 0)
        if (earned) events.emit('rewarded', placement)
        events.emit('dismissed', placement)
        return earned
      } catch {
        events.emit('failed', placement)
        return false
      }
    },
    async prepareInterstitial() {
      if (interstitial) return
      events.emit('requested', 'interstitial')
      try {
        await AdMob.prepareInterstitial({ adId: unitFor('interstitial'), isTesting: testing })
        interstitial = true
        events.emit('loaded', 'interstitial')
      } catch {
        events.emit('failed', 'interstitial')
      }
    },
    interstitialReady: () => interstitial,
    async showInterstitial() {
      if (!interstitial) return false
      interstitial = false
      try {
        events.emit('shown', 'interstitial')
        await AdMob.showInterstitial()
        events.emit('dismissed', 'interstitial')
        return true
      } catch {
        events.emit('failed', 'interstitial')
        return false
      }
    },
    onEvent: (l) => events.on(l),
  }
}
