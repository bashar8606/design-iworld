import { useEffect } from 'react'
import { startFeedback } from './audio/sound.ts'
import { startAds, useAds, watchRewarded } from './store/ads.ts'
import { startShop } from './store/shop.ts'
import { createStressState } from './game/stress.ts'
import { World } from './scene/World.tsx'
import { quality } from './scene/quality.ts'
import { startGameLoop, useGame } from './store/gameStore.ts'
import { startPersistence } from './store/persistence.ts'
import { startTracking } from './store/tracking.ts'
import { startTutorial } from './store/tutorial.ts'
import { useUi } from './store/uiStore.ts'
import { AdOffer, SolarBoostButton } from './ui/AdButtons.tsx'
import { EventBanner, MapComplete, OfflineCard, TutorialHint } from './ui/Cards.tsx'
import { Joystick } from './ui/Controls.tsx'
import { DebugMenu } from './ui/DebugMenu.tsx'
import { FeedbackSheet } from './ui/FeedbackSheet.tsx'
import { Hud } from './ui/Hud.tsx'
import { PerfOverlay } from './ui/PerfOverlay.tsx'
import { ShopSheet, StarterPackCard } from './ui/ShopSheet.tsx'
import { CreditsSheet, SettingsSheet } from './ui/SettingsSheet.tsx'
import { NearbyUpgrade, UpgradeSheet } from './ui/UpgradeSheet.tsx'
import { useKeyboardControls } from './ui/useKeyboardControls.ts'

// The device performance test loads the full layout before anything renders.
if (quality.stress) useGame.getState().replace(createStressState())

function Sheets() {
  const sheet = useUi((s) => s.sheet)
  switch (sheet) {
    case 'settings':
      return <SettingsSheet />
    case 'credits':
      return <CreditsSheet />
    case 'upgrades':
      return <UpgradeSheet />
    case 'debug':
      return <DebugMenu />
    case 'feedback':
      return <FeedbackSheet />
    case 'shop':
      return <ShopSheet />
    default:
      return null
  }
}

export default function App() {
  useEffect(() => startGameLoop(), [])
  useEffect(() => startTracking(), [])
  useEffect(() => startPersistence({ skipLoad: quality.stress }), [])
  useEffect(() => startTutorial(), [])
  useEffect(() => startFeedback(), [])
  // Ads and purchases start once the save has loaded, so grants land on the right state.
  const loaded = useUi((s) => s.loaded)
  useEffect(() => {
    if (!loaded || quality.stress) return
    void startShop()
    return startAds()
  }, [loaded])
  const welcomeBackReady = useAds((s) => s.ready === 'welcome_back')
  useKeyboardControls()
  const open = useUi((s) => s.open)
  return (
    <div className="app">
      <World />
      <Hud>
        <EventBanner />
        <TutorialHint />
        <div className="hud-bottom">
          <AdOffer />
          <NearbyUpgrade />
          <div className="hud-bottom-buttons">
            <SolarBoostButton />
            <button
              className="hud-fab"
              data-hud-control
              onClick={() => open('shop')}
              aria-label="Shop"
            >
              🛒
            </button>
            <button
              className="hud-fab"
              data-hud-control
              onClick={() => open('upgrades')}
              aria-label="Upgrades"
            >
              🔧
            </button>
          </div>
        </div>
      </Hud>
      <Joystick />
      <Sheets />
      <OfflineCard
        onDouble={
          welcomeBackReady ? (earned) => void watchRewarded('welcome_back', earned) : undefined
        }
      />
      <StarterPackCard />
      <MapComplete />
      <PerfOverlay initiallyVisible={quality.stress} />
    </div>
  )
}
