export interface Product {
  id: string
  title: string
  /** Localised price string from the store, e.g. "$2.99". */
  price: string
}

export interface Purchases {
  init(): Promise<void>
  getProducts(): Promise<Product[]>
  /** Resolves true when the purchase completed. */
  purchase(productId: string): Promise<boolean>
  /** Returns the ids of non-consumable products the player owns. */
  restore(): Promise<string[]>
}

export const webPurchases: Purchases = {
  async init() {
    console.info('[purchases] init (web stub)')
  },
  async getProducts() {
    console.info('[purchases] getProducts (web stub)')
    return []
  },
  async purchase(productId) {
    console.info(`[purchases] purchase "${productId}" (web stub, succeeding)`)
    return true
  },
  async restore() {
    console.info('[purchases] restore (web stub)')
    return []
  },
}
