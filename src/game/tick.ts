import { getContent } from './content.ts'
import { Rng } from './rng.ts'
import { buildPadItem } from './state.ts'
import type {
  Car,
  Content,
  GameEvent,
  GameState,
  Staff,
  TickInput,
  TickOptions,
  Vec2,
} from './types.ts'
import { dist, followPath, headingTo, moveToward } from './vec.ts'
import {
  activeEvent,
  arrivalRate,
  batteryCapacity,
  batteryPowerKw,
  bayDef,
  chargerPowerKw,
  clampToBounds,
  dayClock,
  distToPanelRow,
  incomeMultiplier,
  isNight,
  isPadUnlocked,
  itemPos,
  panelRatingKw,
  staffSpeedMultiplier,
  sunIntensity,
} from './world.ts'

export const NO_INPUT: TickInput = { move: { x: 0, z: 0 } }

/** Copies everything a tick mutates, so the input state is never changed. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    player: { ...s.player, pos: { ...s.player.pos } },
    pads: { ...s.pads },
    chargers: s.chargers.map((c) => ({ ...c })),
    panels: s.panels.map((p) => ({ ...p })),
    batteries: s.batteries.map((b) => ({ ...b })),
    facilities: { ...s.facilities },
    staff: s.staff.map((m) => ({ ...m })),
    cars: s.cars.map((c) => ({ ...c })),
    queue: [...s.queue],
    pickups: s.pickups.map((p) => ({ ...p })),
    energy: { ...s.energy },
    eventSchedule: { ...s.eventSchedule },
    contract: s.contract && { ...s.contract },
    boosts: { ...s.boosts },
    prestige: { ...s.prestige },
    stats: { ...s.stats },
    milestones: { ...s.milestones },
    events: [],
  }
}

/**
 * Advances the simulation by `dt` seconds. Pure: returns a new state and never mutates the
 * input. `state.events` holds only what happened during this tick.
 */
export function tick(
  state: GameState,
  dt: number,
  input: TickInput = NO_INPUT,
  options: TickOptions = {},
  content: Content = getContent(state.mapId),
): GameState {
  const s = cloneState(state)
  const rng = new Rng(s.seed)
  const events = s.events

  advanceClock(s, dt, content, events)
  updateWorldEvents(s, dt, rng, content, events)
  finishUpgrades(s, events)
  if (!options.offline) updatePlayer(s, dt, input, content, events)
  updateStaff(s, dt, content, events)
  spawnCars(s, rng, content, events)
  updateCars(s, dt, content, events)
  assignChargers(s, content)
  const delivered = updateEnergy(s, dt, content)
  chargeCars(s, delivered, options, content, events)
  updateDust(s, dt, content)
  updateContract(s, rng, content, events)
  if (options.offline) autoCollect(s)

  if (!s.mapComplete && content.map.pads.every((p) => s.pads[p.id]?.built)) {
    s.mapComplete = true
    events.push({ type: 'mapComplete' })
  }
  s.seed = rng.seed
  return s
}

// ---------------------------------------------------------------------------

function advanceClock(s: GameState, dt: number, content: Content, events: GameEvent[]) {
  const { map } = content
  const wasNight = isNight(s.dayTime, map)
  s.time += dt
  const { day, dayTime } = dayClock(s.time, map)
  s.day = day
  s.dayTime = dayTime
  s.sun = sunIntensity(dayTime, map)
  const night = isNight(dayTime, map)
  if (!wasNight && night) {
    s.stats.carsLostTonight = 0
    events.push({ type: 'nightStarted', day })
  } else if (wasNight && !night) {
    const survived = s.stats.carsLostTonight <= content.economy.milestones.nightSurvivedMaxLost
    // The opening morning is not a night the player has lived through.
    if (s.time > dt * 2) {
      if (s.milestones.firstNightSurvived === null) s.milestones.firstNightSurvived = survived
      events.push({ type: 'dayStarted', day, survived })
    }
  }
}

function updateWorldEvents(
  s: GameState,
  dt: number,
  rng: Rng,
  content: Content,
  events: GameEvent[],
) {
  const { map, events: defs } = content
  const prevTime = s.time - dt
  const e = s.event
  if (e) {
    if (prevTime < e.startsAt && s.time >= e.startsAt) {
      events.push({ type: 'eventStarted', kind: e.kind })
    }
    if (s.time >= e.endsAt) {
      events.push({ type: 'eventEnded', kind: e.kind })
      const def = defs[e.kind]
      s.eventSchedule[e.kind] = s.day + Math.round(rng.range(...def.everyDays))
      s.event = null
    }
    return
  }
  for (const kind of ['sandstorm', 'heatwave', 'nightRush'] as const) {
    const def = defs[kind]
    if (!def || def.enabled === false) continue
    if (s.day < (s.eventSchedule[kind] ?? 0)) continue
    const dayStart = (s.day - map.day.startTime) * map.day.lengthSeconds
    const startsAt = dayStart + def.dayTime * map.day.lengthSeconds
    if (startsAt - def.announceSeconds > s.time) continue
    if (startsAt < s.time) {
      // Missed today's slot (e.g. while offline); try again tomorrow.
      s.eventSchedule[kind] = s.day + 1
      continue
    }
    s.event = { kind, announceAt: s.time, startsAt, endsAt: startsAt + def.durationSeconds }
    events.push({ type: 'eventAnnounced', kind })
    return
  }
}

function finishUpgrades(s: GameState, events: GameEvent[]) {
  for (const item of [...s.chargers, ...s.panels, ...s.batteries]) {
    if (item.upgradingUntil > 0 && s.time >= item.upgradingUntil) {
      item.tier += 1
      item.upgradingUntil = 0
      events.push({ type: 'upgradeDone', id: item.id })
    }
  }
}

function updatePlayer(
  s: GameState,
  dt: number,
  input: TickInput,
  content: Content,
  events: GameEvent[],
) {
  const { map } = content
  const p = s.player
  const len = Math.hypot(input.move.x, input.move.z)
  const k = len > 1 ? 1 / len : 1
  const mx = input.move.x * k
  const mz = input.move.z * k
  p.moving = len > 0.05
  if (p.moving) {
    p.pos = clampToBounds(
      { x: p.pos.x + mx * map.player.speed * dt, z: p.pos.z + mz * map.player.speed * dt },
      map,
    )
    p.heading = Math.atan2(mx, mz)
  }

  // Pay into the nearest open pad the player stands on.
  let padId: string | null = null
  let best = map.player.padRadius
  for (const pad of map.pads) {
    const pState = s.pads[pad.id]
    if (!pState || pState.built || !isPadUnlocked(s, pad)) continue
    const d = dist(p.pos, pad.pos)
    if (d <= best) {
      best = d
      padId = pad.id
    }
  }
  if (padId && s.cash > 0) {
    const pad = map.pads.find((x) => x.id === padId)!
    const pState = { ...s.pads[padId]! }
    const rate = Math.max(pad.price / map.player.buildSeconds, map.player.minDrainPerSecond)
    const pay = Math.min(s.cash, pad.price - pState.paid, rate * dt)
    pState.paid += pay
    s.cash -= pay
    s.pads[padId] = pState
    if (pState.paid >= pad.price - 1e-6) {
      buildPadItem(s, pad, content)
      events.push({ type: 'padBuilt', padId, kind: pad.kind, pos: pad.pos })
    }
  }

  // Plug in a waiting car at a nearby bay.
  const waitingBay = s.chargers
    .map((c) => ({ c, car: s.cars.find((car) => car.id === c.carId) }))
    .find(
      ({ c, car }) =>
        car?.phase === 'waiting' && dist(p.pos, bayDef(map, c.bayId).post) <= map.player.plugRadius,
    )
  if (waitingBay) {
    const progress = p.plug?.bayId === waitingBay.c.bayId ? p.plug.progress + dt : dt
    if (progress >= map.player.plugSeconds) {
      plugCar(waitingBay.car!, 'player', events)
      p.plug = null
    } else {
      p.plug = { bayId: waitingBay.c.bayId, progress }
    }
  } else {
    p.plug = null
  }

  // Collect cash stacks.
  for (const pickup of s.pickups) {
    if (dist(p.pos, pickup.pos) <= map.player.pickupRadius) {
      collect(s, pickup.id, 'player', events)
    }
  }

  // Wipe dusty panels by walking along them.
  for (const panel of s.panels) {
    const pad = map.pads.find((x) => x.id === panel.id)
    if (!pad) continue
    if (distToPanelRow(p.pos, itemPos(pad), map.panelRow.halfLength) <= map.player.cleanRadius) {
      panel.dust = Math.max(0, panel.dust - map.player.cleanPerSecond * dt)
    }
  }
}

function plugCar(car: Car, by: 'player' | 'staff', events: GameEvent[]) {
  car.phase = 'charging'
  events.push({ type: 'carPlugged', carId: car.id, by })
}

function collect(s: GameState, pickupId: number, by: 'player' | 'staff', events: GameEvent[]) {
  const i = s.pickups.findIndex((p) => p.id === pickupId)
  if (i < 0) return
  const [pickup] = s.pickups.splice(i, 1)
  s.cash += pickup!.amount
  if (s.milestones.firstCashAt === null) s.milestones.firstCashAt = s.time
  events.push({ type: 'cashCollected', amount: pickup!.amount, pos: pickup!.pos, by })
}

function autoCollect(s: GameState) {
  for (const pickup of s.pickups) s.cash += pickup.amount
  s.pickups = []
}

function updateStaff(s: GameState, dt: number, content: Content, events: GameEvent[]) {
  const { map, equipment } = content
  for (const m of s.staff) {
    const def = equipment.staff[m.kind]
    const mult = staffSpeedMultiplier(m.kind, m.level, content)
    const step = def.speed * mult * dt

    if (!m.target) m.target = findStaffTask(s, m, content)
    let goal: Vec2 = m.home
    if (m.target?.kind === 'bay') {
      const charger = s.chargers.find((c) => c.bayId === (m.target as { id: string }).id)
      const car = s.cars.find((c) => c.id === charger?.carId)
      if (!car || car.phase !== 'waiting') {
        m.target = null
        m.timer = 0
      } else goal = staffSpot(bayDef(map, charger!.bayId).post, m)
    } else if (m.target?.kind === 'pickup') {
      const id = m.target.id
      const pickup = s.pickups.find((p) => p.id === id)
      if (!pickup) m.target = null
      else goal = pickup.pos
    } else if (m.target?.kind === 'panel') {
      const id = m.target.id
      const panel = s.panels.find((p) => p.id === id)
      const pad = map.pads.find((p) => p.id === id)
      if (!panel || !pad || panel.dust <= 0) m.target = null
      else goal = { x: itemPos(pad).x, z: itemPos(pad).z + 1.1 }
    }

    const [pos] = moveToward(m.pos, goal, step)
    if (dist(m.pos, pos) > 1e-6) m.pos = pos
    const arrived = dist(m.pos, goal) < 0.05
    if (!m.target || !arrived) continue

    if (m.target.kind === 'bay') {
      m.timer += dt * mult
      if (m.timer >= def.taskSeconds) {
        const bayId = m.target.id
        const charger = s.chargers.find((c) => c.bayId === bayId)
        const car = s.cars.find((c) => c.id === charger?.carId)
        if (car?.phase === 'waiting') plugCar(car, 'staff', events)
        m.target = null
        m.timer = 0
      }
    } else if (m.target.kind === 'pickup') {
      collect(s, m.target.id, 'staff', events)
      m.target = null
    } else if (m.target.kind === 'panel') {
      const id = m.target.id
      const panel = s.panels.find((p) => p.id === id)!
      panel.dust = Math.max(0, panel.dust - (def.cleanPerSecond ?? 0) * mult * dt)
      // Walk along the row while cleaning.
      if (panel.dust <= 0) m.target = null
    }
  }
}

/** Offsets staff around a spot so two staff members never stand in the same place. */
function staffSpot(spot: Vec2, m: Staff): Vec2 {
  return m.kind === 'technician' ? { x: spot.x - 0.9, z: spot.z + 0.6 } : spot
}

function findStaffTask(s: GameState, m: Staff, content: Content): Staff['target'] {
  const taken = (pred: (t: NonNullable<Staff['target']>) => boolean) =>
    s.staff.some((o) => o !== m && o.target && pred(o.target))
  if (m.kind === 'technician') {
    let best: Staff['target'] = null
    let bestD = Infinity
    for (const c of s.chargers) {
      const car = s.cars.find((x) => x.id === c.carId)
      if (car?.phase !== 'waiting') continue
      if (taken((t) => t.kind === 'bay' && t.id === c.bayId)) continue
      const d = dist(m.pos, bayDef(content.map, c.bayId).post)
      if (d < bestD) {
        bestD = d
        best = { kind: 'bay', id: c.bayId }
      }
    }
    return best
  }
  if (m.kind === 'cashier') {
    let best: Staff['target'] = null
    let bestScore = -Infinity
    for (const p of s.pickups) {
      if (taken((t) => t.kind === 'pickup' && t.id === p.id)) continue
      const score = p.amount / (1 + dist(m.pos, p.pos))
      if (score > bestScore) {
        bestScore = score
        best = { kind: 'pickup', id: p.id }
      }
    }
    return best
  }
  // Robot: the dustiest row above a small threshold.
  let best: Staff['target'] = null
  let bestDust = 0.1
  for (const p of s.panels) {
    if (taken((t) => t.kind === 'panel' && t.id === p.id)) continue
    if (p.dust > bestDust) {
      bestDust = p.dust
      best = { kind: 'panel', id: p.id }
    }
  }
  return best
}

function spawnCars(s: GameState, rng: Rng, content: Content, events: GameEvent[]) {
  const { map } = content
  if (s.time >= s.nextVipAt) {
    s.vipOfferUntil = s.time + map.vip.offerSeconds
    s.nextVipAt = s.time + rng.range(...map.vip.everySeconds)
  }
  if (s.time < s.nextArrivalAt) return

  const types = Object.entries(map.carTypes)
    .filter(([, t]) => !t.unlockAfter || s.pads[t.unlockAfter]?.built)
    .map(([item, t]) => ({ item, weight: t.weight }))
  const first = s.nextCarId === 1 ? map.initial.firstCarType : undefined
  const type = first ?? rng.pick(types) ?? 'hatchback'
  spawnCar(s, type, false, rng, content)
  const rate = Math.max(0.05, arrivalRate(s, content))
  // Exponential gaps give a Poisson stream of arrivals.
  s.nextArrivalAt = s.time + (-Math.log(1 - rng.next() * 0.999) * 60) / rate
  void events
}

export function spawnCar(s: GameState, type: string, vip: boolean, rng: Rng, content: Content) {
  const { map, cars } = content
  const def = cars[type] ?? cars.hatchback!
  const energy = rng.range(...def.energyKwh)
  const car: Car = {
    id: s.nextCarId++,
    type,
    vip,
    phase: 'approach',
    pos: { x: map.road.laneX, z: map.road.spawnZ },
    heading: 0,
    path: [{ x: map.road.laneX, z: map.road.entranceZ }],
    reversing: false,
    speed: def.speed,
    energyNeeded: Math.round(energy * 10) / 10,
    energyDelivered: 0,
    patience: def.patienceSeconds,
    patienceMax: def.patienceSeconds,
    dwell: 0,
    bayId: null,
  }
  s.cars.push(car)
  return car
}

function updateCars(s: GameState, dt: number, content: Content, events: GameEvent[]) {
  const { map } = content
  const slots = map.queueSlots
  const exitPath = (from: Vec2): Vec2[] => [
    { x: map.lane.x, z: Math.max(from.z, map.lane.exitZ) },
    { x: map.road.laneX, z: map.road.exitZ },
    { x: map.road.laneX, z: map.road.despawnZ },
  ]

  for (const car of s.cars) {
    // Move.
    if (car.path.length > 0) {
      const moved = followPath(car.pos, car.path, car.speed * dt)
      car.pos = moved.pos
      car.path = moved.path
      if (moved.heading !== null)
        car.heading = car.reversing ? moved.heading + Math.PI : moved.heading
    }
    const arrived = car.path.length === 0

    if (
      car.phase === 'queue' ||
      car.phase === 'toBay' ||
      car.phase === 'waiting' ||
      car.phase === 'charging'
    ) {
      car.dwell += dt
    }
    if (car.phase === 'queue' || car.phase === 'waiting' || car.phase === 'toBay') {
      car.patience -= dt
      if (car.patience <= 0) {
        leaveAngry(s, car, content, events)
        continue
      }
    }

    switch (car.phase) {
      case 'approach':
        if (!arrived) break
        if (s.queue.length < slots.length) {
          car.phase = 'queue'
          s.queue.push(car.id)
          car.path = [{ x: map.lane.x, z: map.lane.entryZ }, slots[s.queue.length - 1]!]
          events.push({ type: 'carArrived', carId: car.id })
        } else {
          car.phase = 'passing'
          car.path = [{ x: map.road.laneX, z: map.road.despawnZ }]
        }
        break
      case 'toBay':
        if (arrived) {
          car.phase = 'waiting'
          const bay = bayDef(map, car.bayId!)
          car.heading = headingTo(bay.car, bay.post)
        }
        break
      case 'leaving':
      case 'angry':
        if (arrived && car.reversing) {
          car.reversing = false
          releaseBay(s, car)
          car.path = exitPath(car.pos)
        }
        break
      default:
        break
    }
  }

  // Queue: each car drives to its slot as the line moves up.
  s.queue.forEach((carId, i) => {
    const car = s.cars.find((c) => c.id === carId)
    const slot = slots[i]
    if (!car || !slot) return
    if (car.path.length === 0) {
      if (dist(car.pos, slot) > 0.05) car.path = [slot]
    } else {
      car.path[car.path.length - 1] = slot
    }
  })

  // Remove cars that have driven off.
  s.cars = s.cars.filter(
    (c) =>
      !(
        (c.phase === 'leaving' || c.phase === 'angry' || c.phase === 'passing') &&
        !c.reversing &&
        c.path.length === 0
      ),
  )
}

function releaseBay(s: GameState, car: Car) {
  for (const c of s.chargers) if (c.carId === car.id) c.carId = null
  car.bayId = null
}

function leaveAngry(s: GameState, car: Car, content: Content, events: GameEvent[]) {
  const { map } = content
  const wasQueued = car.phase === 'queue'
  car.phase = 'angry'
  s.stats.carsLost += 1
  if (isNight(s.dayTime, map)) s.stats.carsLostTonight += 1
  events.push({ type: 'carLost', carId: car.id })
  if (wasQueued) {
    s.queue = s.queue.filter((id) => id !== car.id)
    car.path = [
      { x: map.road.laneX, z: car.pos.z + 3 },
      { x: map.road.laneX, z: map.road.despawnZ },
    ]
  } else if (car.bayId) {
    car.reversing = true
    car.path = [{ x: map.lane.x, z: bayDef(map, car.bayId).car.z }]
  } else {
    car.path = [{ x: map.road.laneX, z: map.road.despawnZ }]
  }
}

function assignChargers(s: GameState, content: Content) {
  const { map } = content
  for (const charger of s.chargers) {
    if (charger.carId !== null) continue
    const carId = s.queue[0]
    if (carId === undefined) return
    const car = s.cars.find((c) => c.id === carId)
    if (!car) {
      s.queue.shift()
      continue
    }
    s.queue.shift()
    const bay = bayDef(map, charger.bayId)
    charger.carId = car.id
    car.bayId = charger.bayId
    car.phase = 'toBay'
    car.path = [
      { x: map.lane.x, z: Math.max(car.pos.z, map.lane.entryZ) },
      { x: map.lane.x, z: bay.car.z },
      bay.car,
    ]
  }
}

/** Returns kWh delivered to each charging car this tick, keyed by car id. */
function updateEnergy(s: GameState, dt: number, content: Content): Map<number, number> {
  const scale = content.map.energy.kwhPerKwSecond
  const kwh = scale * dt
  const event = activeEvent(s)
  const eventOutput =
    event?.kind === 'sandstorm' ? (content.events.sandstorm.panelOutputMultiplier ?? 1) : 1

  let producedKw = 0
  for (const panel of s.panels) {
    const loss = panel.dust * content.map.dust.maxOutputLoss
    producedKw += panelRatingKw(panel, content) * s.sun * (1 - loss) * eventOutput
  }

  // What each charging car wants this tick.
  const wants = new Map<number, number>()
  let demandKw = 0
  for (const charger of s.chargers) {
    const car = s.cars.find((c) => c.id === charger.carId)
    if (car?.phase !== 'charging') continue
    const remaining = Math.max(0, car.energyNeeded - car.energyDelivered)
    const kw = Math.min(chargerPowerKw(charger, content), remaining / kwh)
    wants.set(car.id, kw)
    demandKw += kw
  }

  s.energy.capacity = batteryCapacity(s.batteries, content)
  const batteryKw = batteryPowerKw(s.batteries, content)
  let availableKw = producedKw
  let batteryFlow: number
  if (producedKw >= demandKw) {
    const room = Math.max(0, s.energy.capacity - s.energy.stored) / kwh
    batteryFlow = Math.min(producedKw - demandKw, batteryKw, room)
  } else {
    const discharge = Math.min(demandKw - producedKw, batteryKw, s.energy.stored / kwh)
    batteryFlow = -discharge
    availableKw += discharge
  }
  s.energy.stored = Math.min(s.energy.capacity, Math.max(0, s.energy.stored + batteryFlow * kwh))

  const ratio = demandKw > 0 ? Math.min(1, availableKw / demandKw) : 1
  const delivered = new Map<number, number>()
  let deliveredKw = 0
  for (const [carId, kw] of wants) {
    delivered.set(carId, kw * ratio * kwh)
    deliveredKw += kw * ratio
  }
  s.energy.produced = producedKw
  s.energy.delivered = deliveredKw
  s.energy.batteryFlow = batteryFlow
  s.energy.blackout = demandKw > 0 && ratio < 0.5 && s.energy.stored < 0.5
  s.stats.energyProduced += producedKw * kwh
  s.stats.energyDelivered += deliveredKw * kwh
  return delivered
}

function chargeCars(
  s: GameState,
  delivered: Map<number, number>,
  options: TickOptions,
  content: Content,
  events: GameEvent[],
) {
  const { map, cars, economy } = content
  for (const car of s.cars) {
    if (car.phase !== 'charging') continue
    car.energyDelivered += delivered.get(car.id) ?? 0
    if (car.energyDelivered < car.energyNeeded - 1e-6) continue

    const def = cars[car.type] ?? cars.hatchback!
    let amount = car.energyNeeded * def.pricePerKwh * (car.vip ? map.vip.payMultiplier : 1)
    // Drivers who wait spend money at the café and car wash.
    const extra = Math.min(
      Math.max(0, car.dwell - map.spending.minDwellSeconds),
      map.spending.maxDwellBonusSeconds,
    )
    let cafe = s.facilities.cafe ? (map.spending.cafePerMinute * extra) / 60 : 0
    let carWash = s.facilities.carWash ? (map.spending.carWashPerMinute * extra) / 60 : 0
    const scale = incomeMultiplier(s, content) * (options.offline ? economy.offline.efficiency : 1)
    cafe = Math.round(cafe * scale * 100) / 100
    carWash = Math.round(carWash * scale * 100) / 100
    amount = Math.round(amount * scale * 100) / 100 + cafe + carWash

    const bay = bayDef(map, car.bayId!)
    const stack = s.pickups.find((p) => p.bayId === bay.id)
    if (stack) stack.amount += amount
    else
      s.pickups.push({
        id: s.nextPickupId++,
        pos: { ...bay.post, x: bay.post.x + content.map.cashStackOffset },
        amount,
        bayId: bay.id,
      })
    s.stats.carsServed += 1
    s.stats.totalEarned += amount
    if (car.type === 'taxi') {
      s.stats.taxisServed += 1
      if (s.contract) s.contract.taxisServed += 1
    }
    events.push({ type: 'carPaid', carId: car.id, amount, pos: bay.post, cafe, carWash })

    car.phase = 'leaving'
    car.reversing = true
    car.path = [{ x: map.lane.x, z: bay.car.z }]
  }
}

function updateDust(s: GameState, dt: number, content: Content) {
  const event = activeEvent(s)
  const mult = event?.kind === 'sandstorm' ? (content.events.sandstorm.dustMultiplier ?? 1) : 1
  for (const panel of s.panels) {
    panel.dust = Math.min(1, panel.dust + content.map.dust.perSecond * mult * dt)
  }
}

function updateContract(s: GameState, rng: Rng, content: Content, events: GameEvent[]) {
  const def = content.map.contracts
  if (!def) return
  const c = s.contract
  if (c) {
    if (c.taxisServed >= c.taxisRequired) {
      s.cash += c.bonus
      s.stats.totalEarned += c.bonus
      events.push({ type: 'contractDone', bonus: c.bonus })
      s.contract = null
      s.nextContractAt = s.time + rng.range(...def.everySeconds)
    } else if (s.time >= c.endsAt) {
      events.push({ type: 'contractFailed' })
      s.contract = null
      s.nextContractAt = s.time + rng.range(...def.everySeconds)
    }
    return
  }
  if (s.time >= s.nextContractAt) {
    const taxis = Math.round(rng.range(...def.taxis))
    s.contract = {
      taxisRequired: taxis,
      taxisServed: 0,
      endsAt: s.time + def.durationSeconds,
      bonus: Math.round(taxis * def.bonusPerTaxi * incomeMultiplier(s, content)),
    }
  }
}
