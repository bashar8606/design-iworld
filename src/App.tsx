import { useEffect } from 'react'
import { startFeedback } from './audio/sound.ts'
import { createStressState } from './game/stress.ts'
import { World } from './scene/World.tsx'
import { quality } from './scene/quality.ts'
import { startAds, useAds, watchRewarded } from './store/ads.ts'
import { startGameLoop, useGame } from './store/gameStore.ts'
import { startPersistence } from './store/persistence.ts'
import { loadRemoteConfig } from './store/remoteConfig.ts'
import { startShop } from './store/shop.ts'
import { initialStoreMode, startStoreMode, useStoreMode } from './store/storeMode.ts'
import { startTracking } from './store/tracking.ts'
import { startTutorial, useTutorial } from './store/tutorial.ts'
import { useUi } from './store/uiStore.ts'
import { AdOffer } from './ui/AdButtons.tsx'
import { BottomNav } from './ui/BottomNav.tsx'
import {
  ContractBanner,
  EventBanner,
  MapComplete,
  OfflineCard,
  StormOverlay,
  TutorialHint,
} from './ui/Cards.tsx'
import { GreenCreditsSheet } from './ui/GreenCreditsSheet.tsx'
import { Joystick } from './ui/Controls.tsx'
import { DebugMenu } from './ui/DebugMenu.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
import { FeedbackSheet } from './ui/FeedbackSheet.tsx'
import { Hud } from './ui/Hud.tsx'
import { QuarryHud } from './ui/QuarryHud.tsx'
import { selectQuarryOn } from './store/view.ts'
import { LayoutViewBar } from './ui/LayoutViewBar.tsx'
import { MapSheet } from './ui/MapSheet.tsx'
import { MissionCard, MissionsSheet } from './ui/Missions.tsx'
import { PerfOverlay } from './ui/PerfOverlay.tsx'
import { ShopSheet, StarterPackCard } from './ui/ShopSheet.tsx'
import { CreditsSheet, SettingsSheet } from './ui/SettingsSheet.tsx'
import { UpgradeCard, UpgradeSheet } from './ui/UpgradeSheet.tsx'
import { useKeyboardControls } from './ui/useKeyboardControls.ts'

// The device performance test loads the full layout before anything renders.
if (quality.stress) useGame.getState().replace(createStressState())
// App Store capture mode never shows the tutorial and never touches the real save.
if (initialStoreMode()) useTutorial.setState({ active: false })

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
    case 'greenCredits':
      return <GreenCreditsSheet />
    case 'missions':
      return <MissionsSheet />
    case 'map':
      return <MapSheet />
    default:
      return null
  }
}

export default function App() {
  const store = useStoreMode((s) => s.active)
  useEffect(() => startGameLoop(), [])
  useEffect(() => startStoreMode(), [])
  useEffect(() => {
    if (store) return
    const stop = startTracking()
    void loadRemoteConfig()
    return stop
  }, [store])
  useEffect(() => (store ? undefined : startPersistence({ skipLoad: quality.stress })), [store])
  useEffect(() => (store ? undefined : startTutorial()), [store])
  useEffect(() => startFeedback(), [])
  // Ads and purchases start once the save has loaded, so grants land on the right state.
  const loaded = useUi((s) => s.loaded)
  useEffect(() => {
    if (!loaded || quality.stress || store) return
    void startShop()
    return startAds()
  }, [loaded, store])
  const welcomeBackReady = useAds((s) => s.ready === 'welcome_back')
  useKeyboardControls()
  const open = useUi((s) => s.open)
  const layoutView = useUi((s) => s.layoutView)
  const quarry = useGame(selectQuarryOn)
  const sell = () => {
    useGame.getState().dispatch({ type: 'sellToUtility' })
    open('greenCredits')
  }
  return (
    <div className="app">
      <World />
      {!quarry && <StormOverlay />}
      {layoutView ? (
        <LayoutViewBar />
      ) : quarry ? (
        <ErrorBoundary name="hud">
          <QuarryHud allowDebug={!store} />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary name="hud">
          <Hud allowDebug={!store}>
            <div className="hud-under-bar">
              <div className="hud-banners">
                <EventBanner />
                <ContractBanner />
                {!store && <TutorialHint />}
              </div>
              {!store && <MissionCard />}
            </div>
            <div className="hud-bottom">
              {!store && <AdOffer />}
              {!store && <UpgradeCard />}
              <BottomNav store={store} />
            </div>
          </Hud>
        </ErrorBoundary>
      )}
      {!layoutView && <Joystick />}
      <ErrorBoundary name="sheets">
        <Sheets />
      </ErrorBoundary>
      {!store && !layoutView && !quarry && (
        <>
          <OfflineCard
            onDouble={
              welcomeBackReady ? (earned) => void watchRewarded('welcome_back', earned) : undefined
            }
          />
          <StarterPackCard />
          <MapComplete onSell={sell} />
          <PerfOverlay initiallyVisible={quality.stress} />
        </>
      )}
    </div>
  )
}
