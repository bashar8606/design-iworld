import { App } from '@capacitor/app'

export interface Lifecycle {
  /** Calls back with false when the app goes to the background and true when it returns. */
  onActiveChange(callback: (active: boolean) => void): () => void
  /** Deep links (solaroasis://…), including the one that launched the app. */
  onUrlOpen(callback: (url: string) => void): () => void
}

export const webLifecycle: Lifecycle = {
  onActiveChange(callback) {
    const handler = () => callback(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handler)
    window.addEventListener('pagehide', () => callback(false))
    return () => document.removeEventListener('visibilitychange', handler)
  },
  onUrlOpen() {
    return () => {}
  },
}

export const nativeLifecycle: Lifecycle = {
  onActiveChange(callback) {
    const handle = App.addListener('appStateChange', ({ isActive }) => callback(isActive))
    return () => {
      void handle.then((h) => h.remove())
    }
  },
  onUrlOpen(callback) {
    void App.getLaunchUrl().then((launch) => launch?.url && callback(launch.url))
    const handle = App.addListener('appUrlOpen', ({ url }) => callback(url))
    return () => {
      void handle.then((h) => h.remove())
    }
  },
}
