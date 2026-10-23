import { useEffect, useState } from 'react'
import { type PerfSnapshot, onPerf } from '../scene/perfStats.ts'

/** fps, frame time p50/p95, draw calls and triangles. Three-finger tap (or P) toggles it. */
export function PerfOverlay({ initiallyVisible = false }: { initiallyVisible?: boolean }) {
  const [visible, setVisible] = useState(initiallyVisible)
  const [stats, setStats] = useState<PerfSnapshot | null>(null)
  useEffect(() => onPerf(setStats), [])
  useEffect(() => {
    const touch = (e: TouchEvent) => {
      if (e.touches.length === 3) setVisible((v) => !v)
    }
    const key = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') setVisible((v) => !v)
    }
    window.addEventListener('touchstart', touch)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('touchstart', touch)
      window.removeEventListener('keydown', key)
    }
  }, [])
  if (!visible || !stats) return null
  const bad = stats.p95 > 20
  return (
    <div className={`perf-overlay${bad ? ' perf-bad' : ''}`}>
      <div>{stats.fps.toFixed(0)} fps</div>
      <div>
        p50 {stats.p50.toFixed(1)} · p95 {stats.p95.toFixed(1)} ms
      </div>
      <div>{stats.drawCalls} draws</div>
      <div>{(stats.triangles / 1000).toFixed(1)}k tris</div>
    </div>
  )
}
