// Crash and error reporting with Sentry's Capacitor SDK (native crashes on iOS, JS errors
// everywhere). Loaded only when VITE_SENTRY_DSN is set, so the default build carries none of it.

export async function initCrashReporting(release: string): Promise<boolean> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return false
  const [Sentry, SentryReact] = await Promise.all([
    import('@sentry/capacitor'),
    import('@sentry/react'),
  ])
  Sentry.init(
    {
      dsn,
      release: `solar-oasis@${release}`,
      // Release health (crash-free sessions) is what the TestFlight gate needs; keep traces light.
      tracesSampleRate: 0.05,
      enableAutoSessionTracking: true,
    },
    SentryReact.init,
  )
  return true
}
