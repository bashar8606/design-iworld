// Headless balancing: runs bots that play the real src/game code for simulated days.
//   npm run sim                 7 days, all bots, CSV + HTML report in tools/sim/out
//   npm run sim -- --days 3 --bots smart,idle --tune
import { join, resolve } from 'node:path'
import { getContent } from '../../src/game/content.ts'
import { checkMilestones, writeCsv, writeReport } from './report.ts'
import { type BotConfig, nightTest, runBot } from './run.ts'
import { suggestTuning } from './tune.ts'

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const days = Number(arg('days') ?? 7)
const mapId = arg('map') ?? 'map1'
const wanted = (arg('bots') ?? 'greedy,smart,idle').split(',')
const outDir = resolve(arg('out') ?? join(import.meta.dirname, 'out'))
const content = getContent(mapId)

const configs: BotConfig[] = []
for (const strategy of wanted as BotConfig['strategy'][]) {
  const schedule = strategy === 'idle' ? 'idle' : 'engaged'
  configs.push({ name: strategy, strategy, ads: false, schedule })
  configs.push({ name: `${strategy}+ads`, strategy, ads: true, schedule })
}

const results = configs.map((config) => {
  const t0 = performance.now()
  const result = runBot(config, days, mapId, content)
  const m = result.milestones
  console.log(
    `${config.name.padEnd(12)} ${((performance.now() - t0) / 1000).toFixed(1)}s  earned ${Math.round(result.totalEarned).toLocaleString()}  ` +
      `cash@${m.firstCashSeconds?.toFixed(0)}s charger@${m.firstChargerSeconds?.toFixed(0)}s battery@${m.firstBatterySeconds?.toFixed(0)}s ` +
      `tech@${m.firstTechnicianSeconds?.toFixed(0)}s complete@${m.mapCompleteDays?.toFixed(2) ?? 'never'}d  lost ${result.final.stats.carsLost}/${result.final.stats.carsServed + result.final.stats.carsLost}`,
  )
  writeCsv(outDir, result)
  return result
})

const checks = results.filter((r) => !r.config.ads).flatMap(checkMilestones)
const night = nightTest(mapId, content)
const adSpeedups = results
  .filter((r) => !r.config.ads)
  .map((r) => {
    const withAds = results.find((x) => x.config.name === `${r.config.name}+ads`)
    const a = r.milestones.mapCompleteDays
    const b = withAds?.milestones.mapCompleteDays
    if (a && b) return { bot: r.config.name, speedup: a / b - 1 }
    // Not completed: compare total earnings instead.
    return {
      bot: r.config.name,
      speedup: withAds ? withAds.totalEarned / Math.max(1, r.totalEarned) - 1 : null,
    }
  })
writeReport(outDir, results, checks, { night, adSpeedups })

console.log('\nMilestones (smart and idle must be within tolerance):')
for (const c of checks) {
  console.log(
    `  ${c.ok ? 'ok ' : 'OFF'} ${c.bot.padEnd(7)} ${c.milestone.padEnd(18)} ${c.value === null ? 'never' : c.value.toFixed(c.milestone === 'Map 1 complete' ? 2 : 0)}  (${c.target})`,
  )
}
console.log(
  `\nFirst night: without battery ${night.withoutBattery.lost} lost / ${night.withoutBattery.served} served; with battery ${night.withBattery.lost} lost / ${night.withBattery.served} served`,
)
console.log(
  `Ad speed-up: ${adSpeedups.map((a) => `${a.bot} ${a.speedup === null ? 'n/a' : `${Math.round(a.speedup * 100)}%`}`).join(', ')}`,
)
console.log(`\nReport: ${join(outDir, 'report.html')}`)
if (args.includes('--tune')) {
  console.log('\nSuggested changes (not applied):')
  for (const line of suggestTuning(checks, content)) console.log(`  ${line}`)
}
