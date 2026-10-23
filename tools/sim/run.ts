// Runs one bot through simulated days of sessions and offline gaps, recording every minute.
import { applyAction } from '../../src/game/actions.ts'
import { getContent } from '../../src/game/content.ts'
import { buildPadItem, createInitialState } from '../../src/game/state.ts'
import { NO_INPUT, tick } from '../../src/game/tick.ts'
import type { Content, GameState } from '../../src/game/types.ts'
import { isNight } from '../../src/game/world.ts'
import pacing from '../../src/content/pacing.json'
import { Bot, type Strategy } from '../../src/game/autopilot.ts'

export interface BotConfig {
  name: string
  strategy: Strategy
  ads: boolean
  schedule: keyof typeof pacing.schedules
}

export interface MinuteRow {
  minute: number
  day: number
  mode: 'play' | 'offline'
  playSeconds: number
  cash: number
  incomePerMinute: number
  energyProduced: number
  energyDelivered: number
  stored: number
  sun: number
  night: boolean
  carsServed: number
  carsLost: number
  padsBuilt: number
}

export interface Milestones {
  firstCashSeconds: number | null
  firstChargerSeconds: number | null
  firstBatterySeconds: number | null
  firstBatteryBeforeNight: boolean | null
  firstTechnicianSeconds: number | null
  mapCompleteDays: number | null
}

export interface RunResult {
  config: BotConfig
  rows: MinuteRow[]
  purchases: { pad: string; playSeconds: number; day: number; price: number }[]
  milestones: Milestones
  final: GameState
  totalEarned: number
  adsWatched: number
}

const TICK = 0.1

export function runBot(
  config: BotConfig,
  days: number,
  mapId = 'map1',
  content: Content = getContent(mapId),
): RunResult {
  const sessions = pacing.schedules[config.schedule]
  const activeMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0)
  const bot = new Bot({
    strategy: config.strategy,
    activeShare: Math.min(1, activeMinutes / (24 * 60)),
  })
  let state = createInitialState(mapId, { seed: 1234 })
  const rows: MinuteRow[] = []
  const purchases: RunResult['purchases'] = []
  const milestones: Milestones = {
    firstCashSeconds: null,
    firstChargerSeconds: null,
    firstBatterySeconds: null,
    firstBatteryBeforeNight: null,
    firstTechnicianSeconds: null,
    mapCompleteDays: null,
  }
  let playSeconds = 0
  let wallSeconds = sessions[0]!.hour * 3600
  let minute = 0
  let lastMinuteEarned = 0
  let firstNightAt: number | null = null
  let adsWatched = 0
  const firstPadOfKind = (kind: string) =>
    content.map.pads.filter((p) => p.kind === kind && p.price > 0).map((p) => p.id)
  const chargerPads = firstPadOfKind('charger')
  const batteryPads = firstPadOfKind('battery')
  const techPads = firstPadOfKind('technician')

  const record = (mode: MinuteRow['mode']) => {
    const day = wallSeconds / 86400
    rows.push({
      minute: minute++,
      day: Math.round(day * 1000) / 1000,
      mode,
      playSeconds: Math.round(playSeconds),
      cash: Math.round(state.cash),
      incomePerMinute: Math.round((state.stats.totalEarned - lastMinuteEarned) * 100) / 100,
      energyProduced: Math.round(state.stats.energyProduced),
      energyDelivered: Math.round(state.stats.energyDelivered),
      stored: Math.round(state.energy.stored),
      sun: Math.round(state.sun * 100) / 100,
      night: isNight(state.dayTime, content.map),
      carsServed: state.stats.carsServed,
      carsLost: state.stats.carsLost,
      padsBuilt: Object.values(state.pads).filter((p) => p.built).length,
    })
    lastMinuteEarned = state.stats.totalEarned
  }

  const onEvents = () => {
    for (const e of state.events) {
      if (e.type === 'cashCollected' && milestones.firstCashSeconds === null)
        milestones.firstCashSeconds = playSeconds
      if (e.type === 'nightStarted' && firstNightAt === null) firstNightAt = playSeconds
      if (e.type === 'padBuilt') {
        const price = content.map.pads.find((p) => p.id === e.padId)?.price ?? 0
        purchases.push({
          pad: e.padId,
          playSeconds: Math.round(playSeconds),
          day: wallSeconds / 86400,
          price,
        })
        if (chargerPads.includes(e.padId) && milestones.firstChargerSeconds === null)
          milestones.firstChargerSeconds = playSeconds
        if (batteryPads.includes(e.padId) && milestones.firstBatterySeconds === null) {
          milestones.firstBatterySeconds = playSeconds
          milestones.firstBatteryBeforeNight = firstNightAt === null
        }
        if (techPads.includes(e.padId) && milestones.firstTechnicianSeconds === null)
          milestones.firstTechnicianSeconds = playSeconds
      }
      if (e.type === 'mapComplete' && milestones.mapCompleteDays === null)
        milestones.mapCompleteDays = wallSeconds / 86400
    }
  }

  const endWall = days * 86400
  let dayIndex = 0
  while (wallSeconds < endWall && !state.mapComplete) {
    for (const [i, session] of sessions.entries()) {
      const start = dayIndex * 86400 + session.hour * 3600
      if (start >= endWall) {
        wallSeconds = endWall
        break
      }
      // Offline until the session starts (earnings capped like the real game).
      if (start > wallSeconds) {
        const gap = start - wallSeconds
        const cap = content.economy.offline.capSeconds
        let simulated = 0
        while (simulated < gap) {
          const step = Math.min(60, gap - simulated)
          if (simulated < cap) {
            const run = Math.min(step, cap - simulated)
            for (let t = 0; t < run; t += 1) {
              state = tick(state, Math.min(1, run - t), NO_INPUT, { offline: true }, content)
              onEvents()
            }
          }
          simulated += step
          wallSeconds += step
          if (step === 60) record('offline')
        }
        wallSeconds = start
      }
      // Rewarded ads: a solar boost at the start of the first sessions each day.
      if (config.ads && i < pacing.adsPerDay) {
        state = applyAction(state, { type: 'reward', placement: 'solar_boost' }, content)
        adsWatched++
      }
      for (let t = 0; t < session.minutes * 60; t += TICK) {
        const { input, actions } = bot.decide(state, content)
        for (const action of actions) state = applyAction(state, action, content)
        state = tick(state, TICK, input, {}, content)
        playSeconds += TICK
        wallSeconds += TICK
        onEvents()
        if (Math.round(playSeconds * 10) % 600 === 0) record('play')
        if (state.mapComplete) break
      }
      if (state.mapComplete) break
    }
    dayIndex++
  }
  return {
    config,
    rows,
    purchases,
    milestones,
    final: state,
    totalEarned: state.stats.totalEarned,
    adsWatched,
  }
}

/** Runs the first night twice from just before sunset: without and with a battery. */
export function nightTest(mapId = 'map1', content: Content = getContent(mapId)) {
  const config: BotConfig = { name: 'night', strategy: 'greedy', ads: false, schedule: 'engaged' }
  const bot = new Bot({ strategy: config.strategy, activeShare: 1 })
  let state = createInitialState(mapId, { seed: 99 })
  // Build the opening charger and second panel row, then play up to dusk.
  const until =
    (content.map.day.sunset - content.map.day.startTime) * content.map.day.lengthSeconds - 5
  for (let t = 0; t < until; t += TICK) {
    const { input } = bot.decide({ ...state, cash: 0 }, content)
    state = tick(state, TICK, input, {}, content)
  }
  const night = (s: GameState) => {
    let lost = 0
    let served = 0
    const b = new Bot({ strategy: 'greedy', activeShare: 1 })
    for (
      let t = 0;
      t < content.map.day.lengthSeconds * (1 - content.map.day.sunset + content.map.day.sunrise);
      t += TICK
    ) {
      const { input } = b.decide({ ...s, cash: 0 }, content)
      s = tick(s, TICK, input, {}, content)
      lost += s.events.filter((e) => e.type === 'carLost').length
      served += s.events.filter((e) => e.type === 'carPaid').length
    }
    return { lost, served }
  }
  const withoutBattery = night(state)
  // Same moment, but with the first battery built during the afternoon and full by dusk.
  const pad = content.map.pads.find((p) => p.kind === 'battery')!
  const charged = structuredClone(state)
  buildPadItem(charged, pad, content)
  charged.energy.stored = charged.energy.capacity
  return { withoutBattery, withBattery: night(charged) }
}
