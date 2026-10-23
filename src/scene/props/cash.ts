/** Bills a stack shows for an amount: grows quickly, then slowly. */
export function billsFor(amount: number): number {
  return Math.max(1, Math.min(24, Math.ceil(Math.log2(amount + 1) * 2)))
}
