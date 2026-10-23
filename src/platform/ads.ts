export type AdPlacement = 'double-income' | 'instant-charge' | 'offline-bonus'

export interface Ads {
  init(): Promise<void>
  /** Resolves true only when the player watched to the end and earned the reward. */
  showRewarded(placement: AdPlacement): Promise<boolean>
  showInterstitial(): Promise<void>
}

export const webAds: Ads = {
  async init() {
    console.info('[ads] init (web stub)')
  },
  async showRewarded(placement) {
    console.info(`[ads] rewarded "${placement}" (web stub, granting reward)`)
    return true
  },
  async showInterstitial() {
    console.info('[ads] interstitial (web stub)')
  },
}
