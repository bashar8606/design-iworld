// Placeholder until the balancing bots land.
import { createInitialState } from '../../src/game/state.ts'
import { tick } from '../../src/game/tick.ts'

let state = createInitialState()
for (let i = 0; i < 3000; i++) state = tick(state, 0.1)
console.log(state.time, state.stats)
