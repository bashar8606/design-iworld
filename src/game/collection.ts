// The car album: every model served fills in a card, with stars (and gems) at 1, 25 and 100
// served. Golden cars are rare, pay double and have their own cards. Carried across maps.
import collectionJson from '../content/collection.json'
import type { Car, GameEvent, GameState } from './types.ts'

export interface CardDef {
  id: string
  car: string
  name: string
  vip?: boolean
  golden?: boolean
  /** Cars served for each star. */
  stars: number[]
  /** Gems for each star. */
  gems: number[]
}

export const collection = collectionJson as {
  goldenChance: number
  /** No golden cars until this many have been served, so the opening plays the same. */
  goldenAfterCars: number
  goldenPayMultiplier: number
  setBonusGems: number
  cards: CardDef[]
}

/** The claim id for the reward for filling in every card. */
export const SET_BONUS = 'set'

export function emptyCollection(): GameState['collection'] {
  return { served: {}, claimed: {} }
}

export function cardIdFor(car: Car): string {
  if (car.vip) return 'vip'
  return car.golden ? `${car.type}:gold` : car.type
}

export function starsEarned(card: CardDef, served: number): number {
  return card.stars.filter((n) => served >= n).length
}

/** Stars earned but not yet claimed on one card. */
export function claimableStars(state: GameState, card: CardDef): number {
  const c = state.collection
  return starsEarned(card, c.served[card.id] ?? 0) - (c.claimed[card.id] ?? 0)
}

export function setComplete(state: GameState): boolean {
  return collection.cards.every((card) => (state.collection.claimed[card.id] ?? 0) > 0)
}

/** Everything waiting to be claimed in the album, for the nav badge. */
export function albumClaimable(state: GameState): number {
  const stars = collection.cards.reduce((n, card) => n + claimableStars(state, card), 0)
  const set = setComplete(state) && !state.collection.claimed[SET_BONUS] ? 1 : 0
  return stars + set
}

/** Counts a served car. Mutates `state` (a copy). */
export function recordServed(state: GameState, car: Car, events: GameEvent[]): void {
  const id = cardIdFor(car)
  if (!collection.cards.some((c) => c.id === id)) return
  const before = state.collection.served[id] ?? 0
  state.collection.served = { ...state.collection.served, [id]: before + 1 }
  if (before === 0) events.push({ type: 'cardFound', cardId: id })
}

/** Claims every earned star on a card (or the set bonus) for its gems. */
export function claimCard(state: GameState, id: string): GameState {
  if (id === SET_BONUS) {
    if (!setComplete(state) || state.collection.claimed[SET_BONUS]) return state
    return {
      ...state,
      gems: state.gems + collection.setBonusGems,
      collection: {
        ...state.collection,
        claimed: { ...state.collection.claimed, [SET_BONUS]: 1 },
      },
    }
  }
  const card = collection.cards.find((c) => c.id === id)
  if (!card || claimableStars(state, card) <= 0) return state
  const from = state.collection.claimed[id] ?? 0
  const to = starsEarned(card, state.collection.served[id] ?? 0)
  const gems = card.gems.slice(from, to).reduce((a, b) => a + b, 0)
  return {
    ...state,
    gems: state.gems + gems,
    collection: { ...state.collection, claimed: { ...state.collection.claimed, [id]: to } },
  }
}
