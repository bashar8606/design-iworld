/** When each pad was built (performance.now ms), for the squash-and-stretch pop. */
export const builtAt = new Map<string, number>()

/** Squash-and-stretch scale for an item built moments ago: 1 once settled. */
export function popScale(id: string, now = performance.now()): number {
  const t0 = builtAt.get(id)
  if (t0 === undefined) return 1
  const t = (now - t0) / 1000
  if (t > 0.6) return 1
  // Overshoot spring: starts small, overshoots, settles.
  return 1 - Math.exp(-7 * t) * Math.cos(14 * t) * 0.6
}
