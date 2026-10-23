import {
  type CardDef,
  SET_BONUS,
  claimableStars,
  collection,
  setComplete,
  starsEarned,
} from '../game/collection.ts'
import { useGame } from '../store/gameStore.ts'
import { CAR_ICONS } from './icons.ts'

/** One album card: the car once found (a silhouette before), its stars and the next goal. */
function AlbumCard({ card }: { card: CardDef }) {
  const served = useGame((s) => s.state.collection.served[card.id] ?? 0)
  const ready = useGame((s) => claimableStars(s.state, card))
  const dispatch = useGame((s) => s.dispatch)
  const found = served > 0
  const stars = starsEarned(card, served)
  const next = card.stars[stars]
  const special = card.golden || card.vip
  const nextGems = card.gems.slice(stars - ready, stars).reduce((a, b) => a + b, 0)
  return (
    <div
      className={`album-card${found ? '' : ' is-locked'}${card.golden ? ' is-golden' : ''}${card.vip ? ' is-vip' : ''}`}
    >
      <span className="album-art" aria-hidden>
        {CAR_ICONS[card.vip ? 'vip' : card.car] ?? '🚗'}
      </span>
      <strong className="album-name">{found ? card.name : special ? '???' : card.name}</strong>
      <span className="album-stars" aria-label={`${stars} of ${card.stars.length} stars`}>
        {card.stars.map((_, i) => (
          <span key={i} className={i < stars ? 'is-on' : ''}>
            ★
          </span>
        ))}
      </span>
      {ready > 0 ? (
        <button
          className="btn btn-buy album-claim"
          onClick={() => dispatch({ type: 'claimCard', id: card.id })}
        >
          💎 {nextGems}
        </button>
      ) : (
        <small className="album-next">
          {next === undefined ? 'Complete!' : `${served}/${next} served`}
        </small>
      )}
    </div>
  )
}

/** Every car the station has served, carried across maps; stars pay gems. */
export function Album() {
  const found = useGame(
    (s) => collection.cards.filter((c) => (s.state.collection.served[c.id] ?? 0) > 0).length,
  )
  const complete = useGame((s) => setComplete(s.state))
  const bonusClaimed = useGame((s) => !!s.state.collection.claimed[SET_BONUS])
  const dispatch = useGame((s) => s.dispatch)
  return (
    <>
      <p className="sheet-note">
        {found}/{collection.cards.length} cars found · golden cars are rare and pay double
      </p>
      <div className="album-grid">
        {collection.cards.map((card) => (
          <AlbumCard key={card.id} card={card} />
        ))}
      </div>
      <div className={`mission-row${complete && !bonusClaimed ? ' is-done' : ''}`}>
        <span className="mission-row-icon" aria-hidden>
          🏆
        </span>
        <div className="mission-row-text">
          <strong>Full set</strong>
          <small>Claim a star on every card · 💎 {collection.setBonusGems}</small>
        </div>
        <button
          className="btn btn-buy"
          disabled={!complete || bonusClaimed}
          onClick={() => dispatch({ type: 'claimCard', id: SET_BONUS })}
        >
          {bonusClaimed ? 'Done' : 'Claim'}
        </button>
      </div>
    </>
  )
}
