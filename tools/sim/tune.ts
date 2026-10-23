// --tune: suggests price and rate changes that would bring milestones on target.
// It never edits the JSON; copy the suggestions you agree with into src/content.
import type { Content } from '../../src/game/types.ts'
import pacing from '../../src/content/pacing.json'
import type { MilestoneCheck } from './report.ts'

export function suggestTuning(checks: MilestoneCheck[], content: Content): string[] {
  const targets =
    (pacing.maps as Record<string, { targets: { mapCompleteDays?: number[] } }>)[content.map.id]
      ?.targets ?? {}
  const out: string[] = []
  const pads = content.map.pads
  const byMilestone = (name: string) =>
    checks.filter((c) => c.milestone === name && c.value !== null && !c.ok)
  const scale = (offBy: number) => 1 / (1 + offBy)
  const suggestPad = (kind: string, name: string) => {
    for (const c of byMilestone(name)) {
      const pad = pads.find((p) => p.kind === kind && p.price > 0)
      if (!pad || c.offBy === null) continue
      const next = Math.max(1, Math.round(pad.price * scale(c.offBy)))
      out.push(
        `${c.bot}: ${name} ${c.offBy > 0 ? 'late' : 'early'} by ${Math.round(Math.abs(c.offBy) * 100)}% → pads.${pad.id}.price ${pad.price} → ${next}`,
      )
    }
  }
  suggestPad('charger', 'First new charger')
  suggestPad('battery', 'First battery')
  suggestPad('technician', 'First technician')
  for (const c of byMilestone('First cash')) {
    out.push(
      `${c.bot}: first cash late → raise map.initial / shorten the first car (arrivals.firstCarDelaySeconds ${content.map.arrivals.firstCarDelaySeconds} → 0) or speed up the scooter`,
    )
  }
  for (const c of byMilestone('Map complete')) {
    if (c.offBy === null) continue
    const factor = scale(c.offBy)
    const late = pads.filter((p) => p.price >= 1000)
    out.push(
      `${c.bot}: map complete ${c.offBy > 0 ? 'too slow' : 'too fast'} (${c.value?.toFixed(2)} days vs ${(targets.mapCompleteDays ?? []).join('–')}) → scale prices of ${late.length} late pads (≥ $1,000) by ×${factor.toFixed(2)}, e.g. ${late
        .slice(0, 3)
        .map((p) => `${p.id} ${p.price} → ${Math.round(p.price * factor)}`)
        .join(', ')}`,
    )
  }
  const notCompleted = checks.filter((c) => c.milestone === 'Map complete' && c.value === null)
  for (const c of notCompleted)
    out.push(
      `${c.bot}: never completed map 1 in the run → lower late pad prices, or raise economy.offline.efficiency (${content.economy.offline.efficiency})`,
    )
  return out
}
