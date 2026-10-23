import { World } from './scene/World.tsx'
import { Hud } from './ui/Hud.tsx'

export default function App() {
  return (
    <div className="app">
      <World />
      <Hud />
    </div>
  )
}
