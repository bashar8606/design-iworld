import { Purchases as RevenueCat, PURCHASES_ERROR_CODE } from '@revenuecat/purchases-capacitor'
import type { CustomerInfo, PurchasesPackage } from '@revenuecat/purchases-capacitor'
import shop from '../content/shop.json'
import type { Owned } from '../store/shopLogic.ts'

export interface Product {
  id: string
  /** Localised price string from the store, e.g. "$2.99" or "2,99 €". Never hard-coded. */
  price: string
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed'

export interface Purchases {
  init(appUserId: string): Promise<void>
  getProducts(): Promise<Product[]>
  purchase(productId: string): Promise<PurchaseResult>
  /** Asks the store to restore purchases; the owned list then includes them. */
  restore(): Promise<void>
  /** Everything owned: transactions (consumables and non-consumables) and active entitlements. */
  getOwned(): Promise<Owned>
}

// ---------------------------------------------------------------------------
// Web stub: purchases always succeed and are remembered in localStorage.

const WEB_KEY = 'solar-oasis.webPurchases'

function webOwned(): Owned {
  try {
    return JSON.parse(localStorage.getItem(WEB_KEY) ?? '') as Owned
  } catch {
    return { transactions: [], entitlements: [] }
  }
}

export const webPurchases: Purchases = {
  async init() {
    console.info('[purchases] init (web stub)')
  },
  async getProducts() {
    const prices: Record<string, string> = {
      remove_ads: '$5.99',
      starter_pack: '$1.99',
      income_x2: '$9.99',
      gems_small: '$0.99',
      gems_medium: '$4.99',
      gems_large: '$9.99',
    }
    return shop.products.map((p) => ({ id: p.id, price: `${prices[p.id] ?? '$0.99'} (test)` }))
  },
  async purchase(productId) {
    console.info(`[purchases] purchase "${productId}" (web stub, succeeding)`)
    const owned = webOwned()
    owned.transactions.push({ id: `web-${Date.now()}`, productId })
    if (productId === 'remove_ads' && !owned.entitlements.includes(shop.entitlements.noAds)) {
      owned.entitlements.push(shop.entitlements.noAds)
    }
    try {
      localStorage.setItem(WEB_KEY, JSON.stringify(owned))
    } catch {
      // Storage blocked: the test purchase lasts for this session only.
    }
    return 'purchased'
  },
  async restore() {
    console.info('[purchases] restore (web stub)')
  },
  async getOwned() {
    return webOwned()
  },
}

// ---------------------------------------------------------------------------
// RevenueCat on iOS.

function ownedFrom(info: CustomerInfo): Owned {
  return {
    transactions: info.nonSubscriptionTransactions.map((t) => ({
      id: t.transactionIdentifier,
      productId: t.productIdentifier,
    })),
    entitlements: Object.keys(info.entitlements.active),
  }
}

export function createRevenueCatPurchases(apiKey: string): Purchases {
  let packages: PurchasesPackage[] = []
  const loadPackages = async () => {
    const offerings = await RevenueCat.getOfferings()
    const offering = offerings.all[shop.offering] ?? offerings.current
    packages = offering?.availablePackages ?? []
    return packages
  }
  return {
    async init(appUserId) {
      await RevenueCat.configure({ apiKey, appUserID: appUserId })
    },
    async getProducts() {
      const list = packages.length ? packages : await loadPackages()
      return list.map((p) => ({ id: p.product.identifier, price: p.product.priceString }))
    },
    async purchase(productId) {
      const list = packages.length ? packages : await loadPackages()
      const aPackage = list.find((p) => p.product.identifier === productId)
      if (!aPackage) return 'failed'
      try {
        await RevenueCat.purchasePackage({ aPackage })
        return 'purchased'
      } catch (e) {
        const code = (e as { code?: string }).code
        return code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ? 'cancelled' : 'failed'
      }
    },
    async restore() {
      await RevenueCat.restorePurchases()
    },
    async getOwned() {
      const { customerInfo } = await RevenueCat.getCustomerInfo()
      return ownedFrom(customerInfo)
    },
  }
}
