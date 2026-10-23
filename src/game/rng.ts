// Deterministic PRNG (mulberry32). The seed lives in the state so ticks stay pure.

export function nextRandom(seed: number): [value: number, seed: number] {
  let t = (seed + 0x6d2b79f5) | 0
  const nextSeed = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, nextSeed]
}

/** Mutable helper used inside one tick; write `rng.seed` back to the state afterwards. */
export class Rng {
  seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    const [value, seed] = nextRandom(this.seed)
    this.seed = seed
    return value
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  pick<T>(items: { item: T; weight: number }[]): T | undefined {
    const total = items.reduce((sum, i) => sum + i.weight, 0)
    let roll = this.next() * total
    for (const { item, weight } of items) {
      roll -= weight
      if (roll <= 0) return item
    }
    return items.at(-1)?.item
  }
}
