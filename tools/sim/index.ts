// Headless balancing simulation: runs src/game without rendering.
// Usage: npm run sim -- --minutes 30
import { TICKS_PER_SECOND, createInitialState, elapsedSeconds, tick } from '../../src/game/state.ts'

function readMinutes(argv: string[]): number {
  const index = argv.indexOf('--minutes')
  const value = index >= 0 ? Number(argv[index + 1]) : 10
  return Number.isFinite(value) && value > 0 ? value : 10
}

const minutes = readMinutes(process.argv.slice(2))
const totalTicks = Math.round(minutes * 60 * TICKS_PER_SECOND)

let state = createInitialState()
for (let i = 0; i < totalTicks; i++) state = tick(state)

console.log(`Simulated ${minutes} min (${totalTicks} ticks)`)
console.table({ seconds: elapsedSeconds(state), money: state.money })
