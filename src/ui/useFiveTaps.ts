import { useRef } from 'react'

/** Five quick taps on the clock open the hidden debug menu. */
export function useFiveTaps(onFive: () => void) {
  const taps = useRef<number[]>([])
  return () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 1500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      onFive()
    }
  }
}
