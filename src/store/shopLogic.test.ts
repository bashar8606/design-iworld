import { describe, expect, it } from 'vitest'
import { reconcile } from './shopLogic.ts'

const gems = (id: string) => ({ id, productId: 'gems_small' })

describe('purchase reconciliation', () => {
  it('grants each consumable transaction exactly once', () => {
    const first = reconcile({ transactions: [gems('t1')], entitlements: [] }, [])
    expect(first.grants).toEqual([{ cash: undefined, gems: 80 }])
    const again = reconcile({ transactions: [gems('t1')], entitlements: [] }, first.ledger)
    expect(again.grants).toEqual([])
  })

  it('grants a purchase whose app closed before granting, on the next launch', () => {
    // The ledger was saved before the purchase; the store already has the transaction.
    const next = reconcile({ transactions: [gems('t1'), gems('t2')], entitlements: [] }, ['t1'])
    expect(next.grants).toHaveLength(1)
    expect(next.ledger).toEqual(['t1', 't2'])
  })

  it('does not re-grant old consumables on a fresh install, but keeps permanent purchases', () => {
    const owned = {
      transactions: [
        gems('t1'),
        { id: 't2', productId: 'income_x2' },
        { id: 't3', productId: 'remove_ads' },
      ],
      entitlements: ['no_ads'],
    }
    const fresh = reconcile(owned, null)
    expect(fresh.grants).toEqual([{ permanentX2: true }])
    expect(fresh.noAds).toBe(true)
    expect(fresh.incomeX2).toBe(true)
    expect(fresh.ledger).toEqual(['t1', 't2', 't3'])
  })

  it('remove ads comes back through restore (the entitlement)', () => {
    expect(reconcile({ transactions: [], entitlements: ['no_ads'] }, []).noAds).toBe(true)
    expect(reconcile({ transactions: [], entitlements: [] }, []).noAds).toBe(false)
  })

  it('grants the starter pack contents once and marks it owned', () => {
    const r = reconcile(
      { transactions: [{ id: 's', productId: 'starter_pack' }], entitlements: [] },
      [],
    )
    expect(r.grants).toEqual([{ cash: 2000, gems: 60 }])
    expect(r.starterOwned).toBe(true)
  })
})
