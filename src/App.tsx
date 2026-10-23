import { useEffect } from 'react'
import { World } from './scene/World.tsx'
import { startGameLoop } from './store/gameStore.ts'
import { Joystick } from './ui/Controls.tsx'
import { useKeyboardControls } from './ui/useKeyboardControls.ts'
import { Hud } from './ui/Hud.tsx'

export default function App() {
  useEffect(() => startGameLoop(), [])
  useKeyboardControls()
  return (
    <div className="app">
      <World />
      <Hud />
      <Joystick />
    </div>
  )
}
