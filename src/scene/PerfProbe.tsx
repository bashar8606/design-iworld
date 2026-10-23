import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { publishPerf, summarize } from './perfStats.ts'

/** Records frame times and renderer.info; logs a summary every 60 seconds. */
export function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const window = useRef<number[]>([])
  const minute = useRef<number[]>([])
  const lastPublish = useRef(0)
  const minuteStart = useRef(0)
  const peak = useRef({ drawCalls: 0, triangles: 0 })
  useFrame((_, dt) => {
    const ms = dt * 1000
    window.current.push(ms)
    minute.current.push(ms)
    // renderer.info holds the previous frame's numbers when useFrame runs.
    const drawCalls = gl.info.render.calls
    const triangles = gl.info.render.triangles
    peak.current.drawCalls = Math.max(peak.current.drawCalls, drawCalls)
    peak.current.triangles = Math.max(peak.current.triangles, triangles)
    const now = performance.now()
    if (minuteStart.current === 0) minuteStart.current = now
    if (now - lastPublish.current > 500) {
      lastPublish.current = now
      publishPerf({ ...summarize(window.current.slice(-120)), drawCalls, triangles })
      if (window.current.length > 600) window.current = window.current.slice(-120)
    }
    if (now - minuteStart.current >= 60_000) {
      const s = summarize(minute.current)
      console.log(
        `[perf] 60 s summary: ${s.fps.toFixed(1)} fps, frame time p50 ${s.p50.toFixed(1)} ms, p95 ${s.p95.toFixed(1)} ms, ` +
          `peak ${peak.current.drawCalls} draw calls, ${peak.current.triangles.toLocaleString()} triangles, ${minute.current.length} frames`,
      )
      minute.current = []
      minuteStart.current = now
      peak.current = { drawCalls: 0, triangles: 0 }
    }
  })
  return null
}
