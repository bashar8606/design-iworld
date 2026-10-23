import { useEffect, useRef, useState } from 'react'
import { screenToWorld } from '../scene/constants.ts'
import { useGame } from '../store/gameStore.ts'

const RADIUS = 56

/** Virtual joystick: appears wherever the thumb lands on the lower half of the screen. */
export function Joystick() {
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null)
  const pointer = useRef<number | null>(null)
  const setMove = useGame((s) => s.setMove)

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (pointer.current !== null) return
      const target = e.target as HTMLElement
      if (target.closest('[data-hud-control]')) return
      if (e.clientY < window.innerHeight * 0.5) return
      pointer.current = e.pointerId
      setStick({ ox: e.clientX, oy: e.clientY, x: 0, y: 0 })
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer.current) return
      setStick((s) => {
        if (!s) return s
        let dx = e.clientX - s.ox
        let dy = e.clientY - s.oy
        const d = Math.hypot(dx, dy)
        if (d > RADIUS) {
          dx = (dx / d) * RADIUS
          dy = (dy / d) * RADIUS
        }
        const mag = Math.min(1, d / RADIUS)
        const len = Math.hypot(dx, dy) || 1
        // Screen y grows downward; the world mapping wants y up.
        const w = screenToWorld((dx / len) * mag, (-dy / len) * mag)
        setMove(mag < 0.12 ? { x: 0, z: 0 } : w)
        return { ...s, x: dx, y: dy }
      })
    }
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer.current) return
      pointer.current = null
      setStick(null)
      setMove({ x: 0, z: 0 })
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [setMove])

  if (!stick) return null
  return (
    <div className="joystick" style={{ left: stick.ox, top: stick.oy }}>
      <div
        className="joystick-knob"
        style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }}
      />
    </div>
  )
}
