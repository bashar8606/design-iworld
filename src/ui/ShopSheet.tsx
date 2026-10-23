import { buy, markStarterOffered, productInfo, restorePurchases, useShop } from '../store/shop.ts'
import { useUi } from '../store/uiStore.ts'
import { useGame } from '../store/gameStore.ts'
import { Sheet } from './Sheet.tsx'

const ORDER = ['starter_pack', 'remove_ads', 'income_x2', 'gems_small', 'gems_medium', 'gems_large']

export function ShopSheet() {
  const open = useUi((s) => s.open)
  const shop = useShop()
  const gems = useGame((s) => s.state.gems)
  const owned = (id: string) =>
    (id === 'remove_ads' && shop.noAds) ||
    (id === 'income_x2' && shop.incomeX2) ||
    (id === 'starter_pack' && shop.starterOwned)
  const products = ORDER.map((id) => ({
    id,
    info: productInfo(id),
    price: shop.products.find((p) => p.id === id)?.price,
  }))
  return (
    <Sheet title="Shop" onClose={() => open(null)}>
      <p className="sheet-note">💎 {gems} gems · gems finish upgrades instantly</p>
      {products.map(({ id, info, price }) =>
        info ? (
          <div key={id} className="upgrade-row shop-row">
            <div className="upgrade-text">
              <strong>{info.title}</strong>
              <span>{info.description}</span>
            </div>
            {owned(id) ? (
              <span className="upgrade-max">Owned</span>
            ) : (
              <button
                className="btn btn-buy"
                disabled={!price || shop.busy !== null}
                onClick={() => void buy(id)}
              >
                {shop.busy === id ? '…' : (price ?? '—')}
              </button>
            )}
          </div>
        ) : null,
      )}
      {shop.message && <p className="sheet-note">{shop.message}</p>}
      <button className="btn" disabled={shop.busy !== null} onClick={() => void restorePurchases()}>
        Restore purchases
      </button>
    </Sheet>
  )
}

/** Offered once, after the player's first night, as a card they can dismiss. */
export function StarterPackCard() {
  const firstNightDone = useGame((s) => s.state.milestones.firstNightSurvived !== null)
  const { starterOffered, starterOwned, products } = useShop()
  const price = products.find((p) => p.id === 'starter_pack')?.price
  const info = productInfo('starter_pack')
  if (!firstNightDone || starterOffered || starterOwned || !price || !info) return null
  return (
    <div className="card-backdrop" data-hud-control>
      <div className="card" role="dialog" aria-label="Starter pack">
        <h2>🌅 You made it through the night!</h2>
        <p>{info.description}</p>
        <div className="card-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              markStarterOffered()
              void buy('starter_pack')
            }}
          >
            Starter pack · {price}
          </button>
          <button className="btn" onClick={markStarterOffered}>
            No thanks
          </button>
        </div>
      </div>
    </div>
  )
}
