# Measurement, live tuning and TestFlight (Phase 7)

## Analytics (PostHog)

Set `VITE_POSTHOG_KEY` (and `VITE_POSTHOG_HOST` if you use US cloud) in `.env.local` and
rebuild. The same posthog-js client runs in the browser and inside the iOS web view.

Every event carries `install_date`, `days_since_install`, `app_version` and, for playtest links,
`tester` (from `?tester=NAME`). Events:

| Event                                                                                                 | Properties                                                                   |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `app_open`, `session_start`                                                                           |                                                                              |
| `tutorial_start`, `tutorial_step`, `tutorial_complete`                                                | `step`, `index`                                                              |
| `pad_built`                                                                                           | `id`, `kind`, `cost`, `seconds_since_session_start`, `minutes_since_install` |
| `staff_hired`                                                                                         | `kind`, `id`                                                                 |
| `night_survived`, `first_night_survived`                                                              | `survived`, `day`                                                            |
| `car_lost`                                                                                            | `blackout`                                                                   |
| `event_started`                                                                                       | `kind` (sandstorm, heatwave)                                                 |
| `ad_requested`, `ad_loaded`, `ad_shown`, `ad_offer_shown`, `ad_rewarded`, `ad_failed`, `ad_dismissed` | `placement`                                                                  |
| `interstitial_shown`                                                                                  | `reason`                                                                     |
| `purchase`, `purchases_restored`                                                                      | `product`, `price`                                                           |
| `offline_card_shown`, `offline_card_claimed`                                                          | `earned`, `minutes`, `doubled`                                               |
| `feedback`                                                                                            | `rating`, `text`                                                             |
| `map_complete`, `remote_config_applied`                                                               |                                                                              |
| `session_end`                                                                                         | `minutes`                                                                    |

Create the dashboard (retention D1/D7/D30, minutes per daily player, rewarded ads per daily
player and by placement, tutorial → technician funnel) with:

```sh
POSTHOG_PROJECT_ID=… POSTHOG_PERSONAL_API_KEY=phx_… npm run posthog:insights
```

## Remote config

Create a PostHog feature flag with the key **`balance`**, rolled out to 100%, with a JSON
payload. At launch the game applies it over the bundled values in `src/content`. Only numbers,
booleans and strings under `economy`, `cars`, `equipment`, `events` and `maps.<mapId>` are used;
negative numbers, wrong types and anything that would move the map's layout (`pos`, `bay`,
`bounds`, `road`, …) are dropped, so a bad payload cannot break a save. Offline, the bundled
values are used.

```json
{
  "maps": {
    "map1": {
      "arrivals": { "rushMultiplier": 3 },
      "pads": [{ "id": "battery1", "price": 35 }]
    }
  },
  "economy": { "offline": { "efficiency": 0.6 } }
}
```

Before shipping a change, try it in the balancing sim: copy the payload into `src/content`
temporarily and run `npm run sim -- --tune`.

## Crash reporting (Sentry)

Create a Sentry project for Capacitor/React, put its DSN in `.env.local` as `VITE_SENTRY_DSN`,
then `npm run ios`. Native crashes and JavaScript errors are reported with release
`solar-oasis@<VITE_APP_VERSION>`; release health shows crash-free sessions (the gate is fewer
than 1% of sessions with a crash).

## Feedback

Settings → **Send feedback** asks for a 1–5 rating and a note and sends a `feedback` event.
`src/content/links.json` holds the longer form's URL, the privacy policy and support pages.

## TestFlight

1. Bump `version` in `package.json` and `VITE_APP_VERSION`, and the build number in Xcode
   (App target → General → Build).
2. `npm run ios`, then in Xcode choose **Any iOS Device (arm64)** and **Product → Archive**.
3. In the Organizer, **Distribute App → App Store Connect → Upload**.
4. App Store Connect → TestFlight: add yourself under **Internal Testing** (no review needed).
5. Create an **External** group with a public link. The first external build goes through Beta
   App Review (usually about a day).
6. Recruit testers from your clip accounts, friends and idle-game communities such as
   r/incremental_games (check each community's self-promotion rules). Share the link with
   `?tester=` names only for in-person sessions; TestFlight testers are matched by their
   anonymous id.
7. Submit the launch build for App Review by **21 Dec**, set to **manual release**.

Done when: 100+ external testers installed, day-1 retention ≥ 40% among testers, crashes in
fewer than 1% of sessions, and the launch build approved and waiting.
