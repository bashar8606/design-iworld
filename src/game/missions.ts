// Missions: three short goals at a time ("Serve 10 cars"), counted from game events, with gems and
// cash as rewards. Targets grow as missions are completed; rewards scale with the station's income.
import missionsJson from '../content/missions.json'
import type { GameEvent, GameState, Mission, MissionKind } from './types.ts'

interface Template {
  kind: MissionKind
  title: string
  base?: number
  baseMinutes?: number
  gems: number
  cashMinutes: number
  unlockAfter?: string
}

const config = missionsJson as {
  slots: number
  growth: number
  minCashReward: number
  templates: Template[]
}

/** Cash earned per minute so far, for sizing cash targets and rewards. */
export function incomePerMinute(state: GameState): number {
  return state.time > 60 ? (state.stats.totalEarned / state.time) * 60 : 20
}

function available(state: GameState): Template[] {
  return config.templates.filter((t) => !t.unlockAfter || state.pads[t.unlockAfter]?.built)
}

/** The next mission in the rotation; mutates `state.missions.seq`. */
export function nextMission(state: GameState): Mission {
  const m = state.missions
  const pool = available(state)
  // Skip kinds already active so the three slots differ.
  const active = new Set(m.active.map((a) => a.kind))
  let template = pool[m.seq % pool.length]!
  for (let i = 0; i < pool.length && active.has(template.kind); i++)
    template = pool[(m.seq + i) % pool.length]!
  const level = m.completed
  const income = incomePerMinute(state)
  const target =
    template.kind === 'collectCash'
      ? Math.max(
          20,
          Math.round((income * (template.baseMinutes ?? 3) * config.growth ** (level / 2)) / 10) *
            10,
        )
      : Math.max(1, Math.round((template.base ?? 1) * config.growth ** (level / 3)))
  m.seq += 1
  return {
    id: `m${m.seq}`,
    kind: template.kind,
    title: template.title,
    target,
    progress: 0,
    rewardGems: template.gems,
    rewardCash: Math.max(config.minCashReward, Math.round((income * template.cashMinutes) / 5) * 5),
  }
}

export function initialMissions(state: GameState): GameState['missions'] {
  const s = { ...state, missions: { seq: 0, completed: 0, active: [] as Mission[] } }
  for (let i = 0; i < config.slots; i++) s.missions.active.push(nextMission(s))
  return s.missions
}

/** Adds progress from this tick's (or action's) events. Mutates `state` (a copy). */
export function progressMissions(state: GameState, events: GameEvent[]): void {
  if (events.length === 0) return
  const add = (kind: MissionKind, n: number) => {
    for (const m of state.missions.active)
      if (m.kind === kind && m.progress < m.target) m.progress = Math.min(m.target, m.progress + n)
  }
  for (const e of events) {
    switch (e.type) {
      case 'carPaid': {
        add('serveCars', 1)
        if (state.cars.find((c) => c.id === e.carId)?.type === 'taxi') add('serveTaxis', 1)
        break
      }
      case 'cashCollected':
        add('collectCash', e.amount)
        break
      case 'padBuilt':
        add('buildPads', 1)
        break
      case 'upgradeDone':
        add('upgrade', 1)
        break
      case 'dayStarted':
        if (e.survived) add('surviveNight', 1)
        break
    }
  }
}

export function missionDone(m: Mission): boolean {
  return m.progress >= m.target
}

/** Copies the missions so a tick or action can change them. */
export function cloneMissions(m: GameState['missions']): GameState['missions'] {
  return { ...m, active: m.active.map((a) => ({ ...a })) }
}
