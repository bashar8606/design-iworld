import { describe, expect, it } from 'vitest'
import { applyAction } from '../actions.ts'
import { missionDone } from '../missions.ts'
import { deserializeSave, serializeSave } from '../save.ts'
import { tick } from '../tick.ts'
import { bayDef } from '../world.ts'
import { at, content, newGame, run } from './helpers.ts'

describe('missions', () => {
  it('start with three different missions', () => {
    const s = newGame()
    expect(s.missions.active).toHaveLength(3)
    expect(new Set(s.missions.active.map((m) => m.kind)).size).toBe(3)
  })

  it('count served cars and pay out once when claimed', () => {
    const post = bayDef(content.map, 'bay1').post
    let s = at(newGame(), post.x, post.z)
    const serve = s.missions.active.find((m) => m.kind === 'serveCars')!
    s = {
      ...s,
      missions: {
        ...s.missions,
        active: s.missions.active.map((m) => (m.id === serve.id ? { ...m, target: 2 } : m)),
      },
    }
    for (
      let i = 0;
      i < 3000 && !missionDone(s.missions.active.find((m) => m.id === serve.id)!);
      i++
    )
      s = tick(s, 0.1)
    const done = s.missions.active.find((m) => m.id === serve.id)!
    expect(missionDone(done)).toBe(true)
    const before = { cash: s.cash, gems: s.gems }
    const claimed = applyAction(s, { type: 'claimMission', id: serve.id })
    expect(claimed.cash).toBe(before.cash + done.rewardCash)
    expect(claimed.gems).toBe(before.gems + done.rewardGems)
    expect(claimed.missions.active.some((m) => m.id === serve.id)).toBe(false)
    expect(claimed.missions.active).toHaveLength(3)
    expect(applyAction(claimed, { type: 'claimMission', id: serve.id })).toBe(claimed)
  })

  it('cannot be claimed before they are done', () => {
    const s = newGame()
    expect(applyAction(s, { type: 'claimMission', id: s.missions.active[0]!.id })).toBe(s)
  })

  it('load from saves made before missions existed', () => {
    const s = run(newGame(), 5)
    const old = JSON.parse(serializeSave(s, 0)) as { state: Record<string, unknown> }
    delete old.state.missions
    const loaded = deserializeSave(JSON.stringify(old))!.state
    expect(tick(loaded, 0.1).missions.active).toHaveLength(3)
  })
})
