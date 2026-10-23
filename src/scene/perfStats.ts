// Frame statistics shared between the in-canvas probe and the HTML overlay.

export interface PerfSnapshot {
  fps: number
  p50: number
  p95: number
  drawCalls: number
  triangles: number
}

type Listener = (s: PerfSnapshot) => void
const listeners = new Set<Listener>()
export let latest: PerfSnapshot = { fps: 0, p50: 0, p95: 0, drawCalls: 0, triangles: 0 }

export function onPerf(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishPerf(s: PerfSnapshot): void {
  latest = s
  for (const l of listeners) l(s)
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[i]!
}

/** Summary over a window of frame times (ms). */
export function summarize(frameTimes: number[]): { fps: number; p50: number; p95: number } {
  const sorted = [...frameTimes].sort((a, b) => a - b)
  const total = frameTimes.reduce((sum, t) => sum + t, 0)
  return {
    fps: total > 0 ? (frameTimes.length * 1000) / total : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  }
}
