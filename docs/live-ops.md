# Soft launch and live updates (Phase 9)

Release in **Canada, Australia and the UAE** on 11 Jan (App Store Connect → Pricing and
Availability), read the numbers weekly and decide on a worldwide launch by **7 Feb**.

## Weekly routine

1. **Monday:** in the PostHog dashboard (`npm run posthog:insights`) check D1/D7 retention,
   minutes per daily player, rewarded ads per daily player by country and by placement, and the
   biggest drop in the tutorial → technician funnel. AdMob shows earnings per placement.
2. **Tune through remote config** (the `balance` feature flag, see
   docs/measurement-and-testflight.md): prices, rush strength, ad caps. No app update needed.
   Check every change in the sim first: `npm run sim -- --tune` (and `--map map2`).
3. **Ship an update every 1–2 weeks** with fixes and small content.

## The 7 Feb decision

| Result after 3–4 weeks                              | Next step                                                       |
| --------------------------------------------------- | --------------------------------------------------------------- |
| D1 40%+, D7 12%+, ad income $0.03+ per daily player | Launch worldwide and start map 3                                |
| D1 30–40% or D7 8–12%                               | Two more weeks of tuning, starting with the biggest funnel drop |
| D1 below 30%                                        | Rework the first five minutes, or stop                          |

## Ramadan night rush (first live event)

Ramadan begins around 8 Feb 2027. The game already has a **night rush** event (busier late
evenings, 1.8x arrivals around dayTime 0.9, announced 30 s ahead) that is off by default. Turn it on
for everyone, with no app update, through the `balance` flag payload:

```json
{ "events": { "nightRush": { "enabled": true, "arrivalMultiplier": 1.8 } } }
```

Target it to the UAE with a PostHog release condition on country if you want it regional.

## Map 2 and the prestige reset

- When every map 1 pad is built, the map-complete screen offers **Sell to the utility**: it awards
  Green Credits (√total earned × 0.05), resets the map and opens **map 2, City Mall Car Park**.
- Green Credits buy permanent income levels (+25% each) that carry across maps (🌿 button).
- Map 2: a car park roof with little space, so players build upward: solar carports over the
  bays, a second carport tier and a raised roof deck. 50 kW fast chargers from the start, sedans
  and taxi fleets, and **fleet contracts** (serve N taxis before the deadline for a bonus).
- Balancing: `npm run sim -- --map map2` starts bots with three income levels (what a typical
  map 1 sale buys). The idle bot completes map 2 in about 6.3 days (target: about a week).
- New maps are data: add `src/content/mapN.json`, register it in `src/game/content.ts`, append it
  to `MAP_ORDER`, add its pacing target in `src/content/pacing.json` and tune with the sim.

The map 2 art direction (Magnific prompt in the build plan) and any new models follow the same
three routes as map 1: code first, Blender second, Magnific last.
