import { describe, expect, it } from 'vitest'
import { applyAction } from '../actions.ts'
import { SET_BONUS, albumClaimable, collection, recordServed } from '../collection.ts'
import { deserializeSave, serializeSave } from '../save.ts'
import type { Car, GameEvent, GameState } from '../types.ts'
import { newGame } from './helpers.ts'

function serve(
  state: GameState,
  car: Partial<Car>,
  times = 1,
): { s: GameState; events: GameEvent[] } {
  const s = structuredClone(state)
  const events: GameEvent[] = []
  for (let i = 0; i < times; i++)
    recordServed(s, { type: 'hatchback', vip: false, golden: false, ...car } as Car, events)
  return { s, events }
}

describe('car album', () => {
  it('finds a card on the first car of a kind and counts the rest', () => {
    const { s, events } = serve(newGame(), { type: 'taxi' }, 3)
    expect(events).toEqual([{ type: 'cardFound', cardId: 'taxi' }])
    expect(s.collection.served.taxi).toBe(3)
  })

  it('keeps golden and VIP cars on their own cards', () => {
    let { s } = serve(newGame(), { type: 'sedan', golden: true })
    s = serve(s, { type: 'sedan', vip: true }).s
    expect(s.collection.served['sedan:gold']).toBe(1)
    expect(s.collection.served.vip).toBe(1)
    expect(s.collection.served.sedan).toBeUndefined()
  })

  it('pays gems once for each star earned', () => {
    const card = collection.cards.find((c) => c.id === 'scooter')!
    const { s } = serve(newGame(), { type: 'scooter' }, card.stars[1]!)
    expect(albumClaimable(s)).toBe(2)
    const claimed = applyAction(s, { type: 'claimCard', id: 'scooter' })
    expect(claimed.gems).toBe(s.gems + card.gems[0]! + card.gems[1]!)
    expect(applyAction(claimed, { type: 'claimCard', id: 'scooter' })).toBe(claimed)
  })

  it('pays the set bonus once every card has a star', () => {
    let s = newGame()
    for (const card of collection.cards) {
      s = serve(s, { type: card.car, vip: !!card.vip, golden: !!card.golden }).s
      s = applyAction(s, { type: 'claimCard', id: card.id })
    }
    const gems = s.gems
    s = applyAction(s, { type: 'claimCard', id: SET_BONUS })
    expect(s.gems).toBe(gems + collection.setBonusGems)
    expect(albumClaimable(s)).toBe(0)
  })

  it('loads old saves with an empty album', () => {
    const s = newGame() as Partial<GameState>
    delete s.collection
    const loaded = deserializeSave(serializeSave(s as GameState, 1))!.state
    expect(loaded.collection).toEqual({ served: {}, claimed: {} })
  })
})
