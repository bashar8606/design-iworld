const units = ['', 'K', 'M', 'B', 'T']

/** $1,234 below ten thousand, then $12.3K, $4.56M … */
export function formatCash(value: number): string {
  const v = Math.max(0, value)
  if (v < 10_000) return `$${Math.floor(v).toLocaleString('en-US')}`
  let i = 0
  let n = v
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `$${n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0)}${units[i]}`
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** "5:42 PM" for a fraction of a game day. */
export function clockTime(dayTime: number): string {
  const minutes = Math.floor(dayTime * 24 * 60)
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
