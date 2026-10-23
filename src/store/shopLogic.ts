// Pure purchase bookkeeping: which grants are still owed, so each purchase is granted exactly once
// (even if the app closed mid-purchase) and nothing is granted twice after a reinstall.
import shop from '../content/shop.json'

export interface ShopProduct {
  id: string
  type: 'consumable' | 'nonConsumable'
  title: string
  description: string
  grants: { cash?: number; gems?: number; permanentX2?: boolean; entitlement?: string }
}

export const PRODUCTS = shop.products as ShopProduct[]

export interface StoreTransaction {
  id: string
  productId: string
}

export interface Owned {
  transactions: StoreTransaction[]
  entitlements: string[]
}

/** Transaction ids already granted. null means this install has never reconciled. */
export type Ledger = string[] | null

export interface Grant {
  cash?: number
  gems?: number
  permanentX2?: boolean
}

export interface Reconciled {
  grants: Grant[]
  ledger: string[]
  noAds: boolean
  incomeX2: boolean
  starterOwned: boolean
}

export function reconcile(
  owned: Owned,
  ledger: Ledger,
  products: ShopProduct[] = PRODUCTS,
): Reconciled {
  const byId = new Map(products.map((p) => [p.id, p]))
  const owns = (id: string) => owned.transactions.some((t) => t.productId === id)
  const noAds = owned.entitlements.includes(shop.entitlements.noAds) || owns('remove_ads')
  const incomeX2 = owns('income_x2')
  const grants: Grant[] = []
  if (incomeX2) grants.push({ permanentX2: true })

  // First run on this install: what was bought before (e.g. on an old install whose save is gone)
  // is not granted again; permanent items above still apply.
  if (ledger === null) {
    return {
      grants,
      ledger: owned.transactions.map((t) => t.id),
      noAds,
      incomeX2,
      starterOwned: owns('starter_pack'),
    }
  }
  const granted = new Set(ledger)
  for (const t of owned.transactions) {
    if (granted.has(t.id)) continue
    const product = byId.get(t.productId)
    granted.add(t.id)
    if (!product) continue
    const { cash, gems } = product.grants
    if (cash || gems) grants.push({ cash, gems })
  }
  return { grants, ledger: [...granted], noAds, incomeX2, starterOwned: owns('starter_pack') }
}
