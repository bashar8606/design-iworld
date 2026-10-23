import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Suspense, lazy } from 'react'
import App from './App.tsx'
import { initCrashReporting } from './platform/crash.ts'
import { APP_VERSION } from './store/tracking.ts'
import '@fontsource/fredoka/latin-500.css'
import '@fontsource/fredoka/latin-700.css'
import '@fontsource/lilita-one/latin-400.css'
import './index.css'
import './ui/game-ui.css'

// iOS ignores user-scalable=no in some cases; block pinch and double-tap zoom directly.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
}
document.addEventListener('dblclick', (event) => event.preventDefault(), { passive: false })

// Dev and playtest builds expose the store for scripted checks and the debug menu.
if (import.meta.env.DEV) {
  void import('./store/gameStore.ts').then(({ useGame }) => {
    ;(window as unknown as { __game: typeof useGame }).__game = useGame
  })
}

void initCrashReporting(APP_VERSION)
// Floating cash amounts are drawn on canvases, which only use fonts that have already loaded.
void document.fonts?.load('64px "Lilita One"')

const isGallery =
  window.location.pathname.replace(/\/$/, '').endsWith('/gallery') ||
  new URLSearchParams(window.location.search).has('gallery')
const Gallery = lazy(() => import('./gallery/Gallery.tsx').then((m) => ({ default: m.Gallery })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGallery ? (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
