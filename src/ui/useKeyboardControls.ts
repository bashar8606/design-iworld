import { useEffect } from 'react'
import { screenToWorld } from '../scene/constants.ts'
import { useGame } from '../store/gameStore.ts'

const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

/** WASD and arrow keys on desktop, in screen directions. */
export function useKeyboardControls() {
  const setMove = useGame((s) => s.setMove)
  useEffect(() => {
    const held = new Set<string>()
    const update = () => {
      let x = 0
      let y = 0
      for (const k of held) {
        x += KEYS[k]![0]
        y += KEYS[k]![1]
      }
      const len = Math.hypot(x, y)
      setMove(len > 0 ? screenToWorld(x / len, y / len) : { x: 0, z: 0 })
    }
    const down = (e: KeyboardEvent) => {
      if (!KEYS[e.code] || e.repeat) return
      held.add(e.code)
      update()
    }
    const up = (e: KeyboardEvent) => {
      if (!held.delete(e.code)) return
      update()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [setMove])
}
