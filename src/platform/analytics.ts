export type AnalyticsProps = Record<string, string | number | boolean | null>

export interface Analytics {
  init(): Promise<void>
  /** Ties events to a person (the anonymous tester id) with optional properties. */
  identify(distinctId: string, props?: AnalyticsProps): void
  /** Properties attached to every later event (install date, app version …). */
  register(props: AnalyticsProps): void
  track(event: string, props?: AnalyticsProps): void
  /** Sends queued events now (before the app is suspended). */
  flush(): void
  /** JSON payload of a feature flag (remote config), or null when offline or not set. */
  remoteConfig(flag: string, timeoutMs?: number): Promise<unknown>
}

export const webAnalytics: Analytics = {
  async init() {
    console.info('[analytics] init (web stub)')
  },
  identify(distinctId, props) {
    console.info('[analytics] identify', distinctId, props ?? {})
  },
  register(props) {
    console.info('[analytics] register', props)
  },
  track(event, props) {
    console.info(`[analytics] ${event}`, props ?? {})
  },
  flush() {},
  async remoteConfig() {
    return null
  },
}

/**
 * PostHog on web and iOS (posthog-js runs inside the Capacitor web view). Used when
 * VITE_POSTHOG_KEY is set at build time; otherwise the stub logs to the console.
 */
export function createPostHogAnalytics(apiKey: string, host: string): Analytics {
  let client: typeof import('posthog-js').default | null = null
  const queue: (() => void)[] = []
  const run = (fn: () => void) => (client ? fn() : queue.push(fn))
  return {
    async init() {
      const { default: posthog } = await import('posthog-js')
      posthog.init(apiKey, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        persistence: 'localStorage',
        disable_session_recording: true,
      })
      client = posthog
      for (const fn of queue.splice(0)) fn()
    },
    identify(distinctId, props) {
      run(() => client!.identify(distinctId, props ?? undefined))
    },
    register(props) {
      run(() => client!.register(props))
    },
    track(event, props) {
      run(() => client!.capture(event, props ?? undefined))
    },
    flush() {
      // posthog-js sends with sendBeacon on page hide; nothing extra to do.
    },
    async remoteConfig(flag, timeoutMs = 3000) {
      const posthog = await new Promise<typeof client>((resolve) => {
        const check = () => (client ? resolve(client) : setTimeout(check, 50))
        check()
      })
      if (!posthog) return null
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), timeoutMs)
        posthog.onFeatureFlags(() => {
          clearTimeout(timer)
          resolve(posthog.getFeatureFlagPayload(flag) ?? null)
        })
      })
    },
  }
}
