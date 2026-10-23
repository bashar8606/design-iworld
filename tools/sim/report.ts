// Writes CSVs and an HTML report with D3 charts for the balancing runs.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import pacing from '../../src/content/pacing.json'
import type { Milestones, RunResult } from './run.ts'

export interface MilestoneCheck {
  bot: string
  milestone: string
  value: number | null
  target: string
  offBy: number | null
  ok: boolean
}

const fmt = (n: number | null, unit: 's' | 'd') =>
  n === null ? 'never' : unit === 's' ? `${Math.round(n)} s` : `${n.toFixed(2)} days`

type Targets = {
  firstCashSeconds?: number
  firstChargerSeconds?: number
  firstBatterySeconds?: number
  firstTechnicianSeconds?: number
  mapCompleteDays?: number[]
}

export function checkMilestones(result: RunResult, mapId = 'map1'): MilestoneCheck[] {
  const t = (pacing.maps as Record<string, { targets: Targets }>)[mapId]?.targets ?? {}
  const m: Milestones = result.milestones
  const bot = result.config.name
  const rel = (v: number | null, target: number) => (v === null ? null : (v - target) / target)
  const checks: MilestoneCheck[] = []
  const add = (milestone: string, value: number | null, target: string, offBy: number | null) =>
    checks.push({
      bot,
      milestone,
      value,
      target,
      offBy,
      ok: offBy !== null && Math.abs(offBy) <= pacing.tolerance,
    })

  if (t.firstCashSeconds !== undefined) {
    const v = m.firstCashSeconds
    add(
      'First cash',
      v,
      `under ${t.firstCashSeconds} s`,
      v === null ? null : Math.max(0, rel(v, t.firstCashSeconds)!),
    )
  }
  if (t.firstChargerSeconds !== undefined) {
    add(
      'First new charger',
      m.firstChargerSeconds,
      `about ${t.firstChargerSeconds} s`,
      rel(m.firstChargerSeconds, t.firstChargerSeconds),
    )
  }
  if (t.firstBatterySeconds !== undefined) {
    const off = rel(m.firstBatterySeconds, t.firstBatterySeconds)
    add(
      'First battery',
      m.firstBatterySeconds,
      `before the first night (~${t.firstBatterySeconds} s)`,
      m.firstBatteryBeforeNight ? Math.min(0, off ?? 0) : off,
    )
  }
  if (t.firstTechnicianSeconds !== undefined) {
    add(
      'First technician',
      m.firstTechnicianSeconds,
      `about ${t.firstTechnicianSeconds} s`,
      rel(m.firstTechnicianSeconds, t.firstTechnicianSeconds),
    )
  }
  if (t.mapCompleteDays && result.config.schedule === 'idle') {
    const [lo, hi] = t.mapCompleteDays as [number, number]
    const d = m.mapCompleteDays
    add(
      'Map complete',
      d,
      `${lo}–${hi} days`,
      d === null ? null : d < lo ? (d - lo) / lo : d > hi ? (d - hi) / hi : 0,
    )
  }
  return checks
}

export function writeCsv(dir: string, result: RunResult) {
  mkdirSync(dir, { recursive: true })
  const cols = Object.keys(result.rows[0] ?? {}) as (keyof (typeof result.rows)[number])[]
  const lines = [cols.join(','), ...result.rows.map((r) => cols.map((c) => String(r[c])).join(','))]
  writeFileSync(join(dir, `${result.config.name}.csv`), lines.join('\n') + '\n')
  const buys = [
    'pad,playSeconds,day,price',
    ...result.purchases.map((p) => `${p.pad},${p.playSeconds},${p.day.toFixed(3)},${p.price}`),
  ]
  writeFileSync(join(dir, `${result.config.name}-purchases.csv`), buys.join('\n') + '\n')
}

export function writeReport(
  dir: string,
  results: RunResult[],
  checks: MilestoneCheck[],
  extra: {
    night: {
      withoutBattery: { lost: number; served: number }
      withBattery: { lost: number; served: number }
    }
    adSpeedups: { bot: string; speedup: number | null }[]
  },
) {
  // Thin the per-minute series to keep the page light.
  const series = results.map((r) => ({
    name: r.config.name,
    rows: r.rows
      .filter((_, i) => i % 5 === 0)
      .map((row) => ({
        day: row.day,
        income: row.incomePerMinute,
        lost: row.carsLost,
        produced: row.energyProduced,
        delivered: row.energyDelivered,
        night: row.night,
      })),
  }))
  const table = checks
    .map((c) => {
      const unit = c.milestone === 'Map complete' ? 'd' : 's'
      const off = c.offBy === null ? '—' : `${c.offBy > 0 ? '+' : ''}${Math.round(c.offBy * 100)}%`
      return `<tr class="${c.ok ? 'ok' : 'off'}"><td>${c.bot}</td><td>${c.milestone}</td><td>${fmt(c.value, unit)}</td><td>${c.target}</td><td>${off}</td><td>${c.ok ? 'on target' : 'OFF'}</td></tr>`
    })
    .join('\n')
  const ads = extra.adSpeedups
    .map(
      (a) =>
        `<li>${a.bot}: ${a.speedup === null ? 'n/a' : `${Math.round(a.speedup * 100)}% faster`}</li>`,
    )
    .join('')
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Solar Oasis balancing report</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#1f2a33;background:#fbfaf6;max-width:1100px}
h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;font-size:14px}
td,th{padding:6px 10px;border-bottom:1px solid #e3e0d6;text-align:left}tr.off td:last-child{color:#b42318;font-weight:700}
tr.ok td:last-child{color:#2e7d32}.chart{margin:8px 0 20px}.legend span{margin-right:14px;font-size:13px}
</style></head><body>
<h1>Solar Oasis balancing report</h1>
<p>Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by <code>npm run sim</code>. Milestones more than ${Math.round(pacing.tolerance * 100)}% off target are flagged.</p>
<h2>Milestones</h2>
<table><thead><tr><th>Bot</th><th>Milestone</th><th>Result</th><th>Target</th><th>Off by</th><th></th></tr></thead><tbody>${table}</tbody></table>
<h2>First night</h2>
<p>Without a battery: ${extra.night.withoutBattery.lost} cars lost, ${extra.night.withoutBattery.served} served. With one: ${extra.night.withBattery.lost} lost, ${extra.night.withBattery.served} served.</p>
<h2>Rewarded ads (3 Solar Boosts a day)</h2><ul>${ads}</ul>
<h2>Income per minute</h2><div id="income" class="chart"></div>
<h2>Energy in vs out (first two days, per minute)</h2><div id="energy" class="chart"></div>
<h2>Cars lost (cumulative)</h2><div id="lost" class="chart"></div>
<script>
const series = ${JSON.stringify(series)};
const colors = d3.scaleOrdinal(series.map(s => s.name), ['#19B5A5','#1E3557','#F29E4C','#A6E22E','#8FC8F0','#E5484D']);
function line(el, key, opts = {}) {
  const w = 1000, h = 260, m = {t: 10, r: 20, b: 30, l: 60};
  const data = series.map(s => ({ name: s.name, rows: s.rows.filter(r => opts.maxDay ? r.day <= opts.maxDay : true) }));
  const all = data.flatMap(s => s.rows);
  const x = d3.scaleLinear().domain(d3.extent(all, d => d.day)).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(all, d => d[key]) || 1]).nice().range([h - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('viewBox', [0, 0, w, h]).attr('width', '100%');
  svg.append('g').attr('transform', 'translate(0,' + (h - m.b) + ')').call(d3.axisBottom(x).ticks(10).tickFormat(d => 'day ' + d));
  svg.append('g').attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).ticks(5));
  for (const s of data) svg.append('path').datum(s.rows).attr('fill', 'none').attr('stroke', colors(s.name)).attr('stroke-width', 1.5)
    .attr('d', d3.line().x(d => x(d.day)).y(d => y(d[key])));
  const legend = d3.select(el).append('div').attr('class', 'legend');
  for (const s of data) legend.append('span').style('color', colors(s.name)).text('■ ' + s.name);
}
line('#income', 'income');
line('#lost', 'lost');
// Energy: per-minute deltas for the first bot, day vs night shading.
(function () {
  const s = series[0]; const rows = s.rows.filter(r => r.day <= 2);
  const deltas = rows.slice(1).map((r, i) => ({ day: r.day, inKw: r.produced - rows[i].produced, outKw: r.delivered - rows[i].delivered, night: r.night }));
  const w = 1000, h = 260, m = {t: 10, r: 20, b: 30, l: 60};
  const x = d3.scaleLinear().domain(d3.extent(deltas, d => d.day)).range([m.l, w - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(deltas, d => Math.max(d.inKw, d.outKw)) || 1]).nice().range([h - m.b, m.t]);
  const svg = d3.select('#energy').append('svg').attr('viewBox', [0, 0, w, h]).attr('width', '100%');
  svg.append('g').selectAll('rect').data(deltas.filter(d => d.night)).join('rect').attr('x', d => x(d.day)).attr('y', m.t).attr('width', 2).attr('height', h - m.b - m.t).attr('fill', '#1E3557').attr('opacity', 0.08);
  svg.append('g').attr('transform', 'translate(0,' + (h - m.b) + ')').call(d3.axisBottom(x).tickFormat(d => 'day ' + d));
  svg.append('g').attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).ticks(5));
  svg.append('path').datum(deltas).attr('fill', 'none').attr('stroke', '#F7C948').attr('stroke-width', 1.5).attr('d', d3.line().x(d => x(d.day)).y(d => y(d.inKw)));
  svg.append('path').datum(deltas).attr('fill', 'none').attr('stroke', '#19B5A5').attr('stroke-width', 1.5).attr('d', d3.line().x(d => x(d.day)).y(d => y(d.outKw)));
  d3.select('#energy').append('div').attr('class', 'legend').html('<span style="color:#F7C948">■ panels in (kWh/min)</span><span style="color:#19B5A5">■ chargers out (kWh/min)</span><span>shaded: night · bot: ' + s.name + '</span>');
})();
</script></body></html>`
  writeFileSync(join(dir, 'report.html'), html)
}
