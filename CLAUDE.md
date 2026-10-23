# Solar Oasis

Mobile arcade idle tycoon: the player builds solar panels, batteries and EV chargers; cars arrive,
charge and pay. Vite + React 19 + TypeScript (strict), React Three Fiber, zustand, Capacitor 8 (iOS).

## Commands

- `npm run dev` — desktop browser at http://localhost:5173 (also on the LAN for a phone)
- `npm run build` — typecheck + production build into `dist/`
- `npm test` — Vitest
- `npm run lint` / `npm run format` — ESLint / Prettier
- `npm run sim -- --minutes 30` — headless balancing simulation (`tools/sim/index.ts`)
- `npm run ios` — build, `cap sync ios`, open Xcode
- `npm run assets:blender` / `assets:optimize` / `assets:check` / `assets:polyhaven` — asset pipeline

Run `npm run lint`, `npx tsc -b` and `npm test` before every commit.

## Layout

- `src/game/` — pure TypeScript simulation: state, tick, economy, save, offline
- `src/scene/` — React Three Fiber: world, chargers, panels, cars, player, sky
- `src/platform/` — ads, purchases, storage, haptics, analytics (+ web stubs)
- `src/store/` — zustand store, the fixed-step game loop and the game-event bus
- `src/gallery/` — the /gallery asset viewer
- `src/content/` — JSON config: map1/map2, cars, equipment, events, economy, pacing, ads, shop
- `src/audio/` — howler.js sound and haptic feedback
- `src/ui/` — HUD, sheets (upgrades, shop, settings, debug), cards, banners
- `assets-src/` — .blend files, Blender scripts, raw exports, Poly Haven originals
- `public/models/` — compressed .glb files; `public/textures/` — 512 px WebP textures and the HDRI
- `tools/sim/` — balancing bots (greedy, smart, idle), CSV + HTML report, `--tune`
- `tools/store/` — App Store saves, capture (simulator or Chromium), composite, preview video
- `tools/assets/` — Blender rebuild, glTF optimize + gltfjsx, budget check, Poly Haven download
- `ios/` — Capacitor iOS project (Swift Package Manager)

Docs for setup that needs accounts or a Mac live in `docs/` (device test, ads and purchases,
measurement and TestFlight, store listing, live ops).

## Rules

- The simulation lives in `src/game`, ticks 10 times a second and never imports React or three
  (ESLint enforces this). Components only read state and send player actions.
- Every price, speed and rate lives in `src/content/*.json`, never in a component.
- Platform features sit behind the interfaces in `src/platform`, with web stubs, so the game always
  runs in a desktop browser. Get them from `platform` in `src/platform/index.ts`.
- Performance budget on an iPhone 3-4 years old: 60 fps, under 100 draw calls, under 150k
  triangles, textures at most 1024 px. Repeated objects use instancing.
- Save after every purchase and when the app goes to the background.
- After changing any price or rate, run `npm run sim -- --tune` (and `--map map2`) and keep the
  smart and idle bots within 25% of `src/content/pacing.json`.
- zustand selectors must return primitives or stable references; wrap selectors that build
  objects or arrays in `useShallow`, or they re-render forever.
- Platform SDKs (AdMob, RevenueCat, PostHog, Sentry) are only touched in `src/platform`.
