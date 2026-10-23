import { useEffect } from 'react'
import { startFeedback } from './audio/sound.ts'
import { createStressState } from './game/stress.ts'
import { World } from './scene/World.tsx'
import { quality } from './scene/quality.ts'
import { startGameLoop, useGame } from './store/gameStore.ts'
import { startPersistence } from './store/persistence.ts'
import { startTracking } from './store/tracking.ts'
import { startTutorial } from './store/tutorial.ts'
import { useUi } from './store/uiStore.ts'
import { EventBanner, MapComplete, OfflineCard, TutorialHint } from './ui/Cards.tsx'
import { Joystick } from './ui/Controls.tsx'
import { DebugMenu } from './ui/DebugMenu.tsx'
import { FeedbackSheet } from './ui/FeedbackSheet.tsx'
import { Hud } from './ui/Hud.tsx'
import { PerfOverlay } from './ui/PerfOverlay.tsx'
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
  useKeyboardControls()
  const open = useUi((s) => s.open)
  return (
    <div className="app">
      <World />
      <Hud>
        <EventBanner />
        <TutorialHint />
        <div className="hud-bottom">
          <NearbyUpgrade />
          <div className="hud-bottom-buttons">
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
      <OfflineCard />
      <MapComplete />
      <PerfOverlay initiallyVisible={quality.stress} />
    </div>
  )
}
