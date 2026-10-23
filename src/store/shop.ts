// In-app purchases: products with localised prices, buying, restoring and granting exactly once.
import { create } from 'zustand'
import { platform } from '../platform/index.ts'
import type { Product } from '../platform/purchases.ts'
import { useGame } from './gameStore.ts'
import { saveNow } from './persistence.ts'
import { PRODUCTS, reconcile } from './shopLogic.ts'
import { testerId, trackUi } from './tracking.ts'

const NO_ADS_KEY = 'solar-oasis.noAds'
const STARTER_SEEN_KEY = 'solar-oasis.starterOffered'

function flag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function setFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export interface ShopState {
  products: Product[]
  noAds: boolean
  incomeX2: boolean
  starterOwned: boolean
  starterOffered: boolean
  busy: string | null
  message: string | null
}

export const useShop = create<ShopState>()(() => ({
  products: [],
  noAds: flag(NO_ADS_KEY),
  incomeX2: false,
  starterOwned: false,
  starterOffered: flag(STARTER_SEEN_KEY),
  busy: null,
  message: null,
}))

/** Grants whatever the store says is owned but not yet granted, then saves. */
async function syncOwned() {
  const owned = await platform.purchases.getOwned()
  const game = useGame.getState()
  const result = reconcile(owned, game.state.ledger)
  game.dispatch({ type: 'applyPurchases', grants: result.grants, ledger: result.ledger })
  await saveNow()
  setFlag(NO_ADS_KEY, result.noAds)
  useShop.setState({
    noAds: result.noAds,
    incomeX2: result.incomeX2,
    starterOwned: result.starterOwned,
  })
}

export async function startShop() {
  try {
    await platform.purchases.init(testerId())
    await syncOwned()
    useShop.setState({ products: await platform.purchases.getProducts() })
  } catch (e) {
    console.warn('[shop] start', e)
  }
}

export async function buy(productId: string) {
  if (useShop.getState().busy) return
  useShop.setState({ busy: productId, message: null })
  const price = useShop.getState().products.find((p) => p.id === productId)?.price ?? ''
  try {
    const result = await platform.purchases.purchase(productId)
    if (result === 'purchased') {
      await syncOwned()
      trackUi('purchase', { product: productId, price })
      useShop.setState({ message: 'Thank you!' })
    } else if (result === 'failed') {
      useShop.setState({ message: 'The purchase did not go through. You were not charged.' })
    }
  } finally {
    useShop.setState({ busy: null })
  }
}

export async function restorePurchases() {
  useShop.setState({ busy: 'restore', message: null })
  try {
    await platform.purchases.restore()
    await syncOwned()
    useShop.setState({ message: 'Purchases restored.' })
    trackUi('purchases_restored')
  } catch {
    useShop.setState({ message: 'Could not reach the App Store. Try again later.' })
  } finally {
    useShop.setState({ busy: null })
  }
}

/** The starter pack card is offered once, after the player's first night. */
export function markStarterOffered() {
  setFlag(STARTER_SEEN_KEY, true)
  useShop.setState({ starterOffered: true })
}

export const productInfo = (id: string) => PRODUCTS.find((p) => p.id === id)
