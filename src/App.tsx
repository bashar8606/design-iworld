import { useEffect } from 'react'
import { createStressState } from './game/stress.ts'
import { quality } from './scene/quality.ts'
import { World } from './scene/World.tsx'
import { startGameLoop, useGame } from './store/gameStore.ts'
import { startTracking } from './store/tracking.ts'
import { Joystick } from './ui/Controls.tsx'
import { useKeyboardControls } from './ui/useKeyboardControls.ts'
import { Hud } from './ui/Hud.tsx'
import { PerfOverlay } from './ui/PerfOverlay.tsx'

// The device performance test loads the full layout before anything renders.
if (quality.stress) useGame.getState().replace(createStressState())

export default function App() {
  useEffect(() => startGameLoop(), [])
  useEffect(() => startTracking(), [])
  useKeyboardControls()
  return (
    <div className="app">
      <World overview={quality.stress} />
      <Hud />
      <Joystick />
      <PerfOverlay initiallyVisible={quality.stress} />
    </div>
  )
}
