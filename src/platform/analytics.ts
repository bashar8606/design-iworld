export type AnalyticsProps = Record<string, string | number | boolean>

export interface Analytics {
  init(): Promise<void>
  track(event: string, props?: AnalyticsProps): void
}

export const webAnalytics: Analytics = {
  async init() {
    console.info('[analytics] init (web stub)')
  },
  track(event, props) {
    console.info(`[analytics] ${event}`, props ?? {})
  },
}
