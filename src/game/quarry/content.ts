import economyJson from '../../content/economy.json'
import quarry1Json from '../../content/quarry1.json'
import type { EconomyContent } from '../types.ts'
import type { QuarryAllContent, QuarryContent } from './types.ts'

const quarries: Record<string, QuarryContent> = {
  quarry1: quarry1Json as QuarryContent,
}

export const QUARRY_ORDER = ['quarry1']

export function getQuarryContent(quarryId: string): QuarryAllContent {
  const quarry = quarries[quarryId]
  if (!quarry) throw new Error(`Unknown quarry "${quarryId}"`)
  return { quarry, economy: economyJson as EconomyContent }
}
