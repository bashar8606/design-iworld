# App Store listing (Phase 8)

## Text

| Field            | Text                                                                                                 | Limit      |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ---------- |
| Name             | Solar Oasis: EV Charge Tycoon                                                                        | 29 of 30   |
| Subtitle         | Solar EV charging empire                                                                             | 24 of 30   |
| Keywords         | idle,electric,car,station,energy,power,simulator,business,manager,clicker,green,battery,arcade,build | 100 of 100 |
| Promotional text | Sandstorms, heatwaves and the evening rush: keep the chargers running from sunrise to midnight.      | 95 of 170  |

**Description** (up to 4,000 characters)

> Turn a dusty charger on a desert highway into a solar-powered charging empire.
>
> Walk your worker over to each car, plug it in and collect the cash. Lay rows of solar panels,
> store the midday sun in batteries and get ready for the evening rush, when the panels go dark
> and the cars keep coming. Run out of power and drivers leave angry.
>
> • Plan your energy: panels only work in daylight, dust cuts their output, and batteries carry
> the sunshine into the night
> • Beat the rush: more chargers serve more cars, faster chargers serve them sooner
> • Hire staff: technicians plug in cars, cashiers collect payments and cleaning robots keep the
> panels spotless, so the station keeps earning while you are away
> • Upgrade everything: 7 kW to 150 kW chargers, sun-tracking panels, container batteries
> • Weather the weather: sandstorms halve your panels and heatwaves double the traffic
> • Open a café and a car wash for drivers who wait
>
> Relaxing to play in short sessions, satisfying to come back to.

## Screenshots and preview

- Screenshots: `npm run store:saves`, then `npm run store:capture-sim` (Mac) or
  `npm run store:capture-web`, then `npm run store:composite` → `store/screenshots/*.png`
  (1320 × 2868, the 6.9-inch size; App Store Connect scales them for smaller iPhones).
- Headlines: Build a solar charging empire · Beat the evening rush · Store the sun for the night ·
  Survive the sandstorm · Hire staff and go idle.
- Backgrounds: drop the Magnific Seedream backgrounds (prompt 8B in the build plan) into
  `assets-src/store/backgrounds/background.png` or `<save>.png`; until then a generated gradient
  is used.
- Preview: `npm run store:preview -- store/raw/demo.mov` → `store/preview/preview_886x1920.mp4`
  (25 s, 30 fps, captions only). Guideline 2.3.4 allows only captures of the app itself, so record
  real gameplay (the simulator capture) and keep AI video out of the App Store.

## Icon

Both icon directions from the plan (Magnific prompt 8A) go into the build so product page
optimisation can test them after launch: put the 1024 × 1024 PNGs (no transparency) in
`ios/App/App/Assets.xcassets/AppIcon.appiconset/` as the primary icon, and the second as an
alternate icon set.

## App Privacy answers (App Store Connect → App Privacy)

Data collected, none of it sold:

| Data type                                  | Collected by                                     | Linked to the user | Used for tracking | Purpose                             |
| ------------------------------------------ | ------------------------------------------------ | ------------------ | ----------------- | ----------------------------------- |
| Identifiers → Device ID (IDFA)             | AdMob, only after the tracking prompt is allowed | No                 | Yes               | Third-party advertising             |
| Usage data → Advertising data              | AdMob                                            | No                 | Yes               | Third-party advertising             |
| Usage data → Product interaction           | PostHog                                          | No                 | No                | Analytics                           |
| Identifiers → User ID (random tester id)   | PostHog, RevenueCat                              | No                 | No                | Analytics, app functionality        |
| Purchases → Purchase history               | RevenueCat                                       | No                 | No                | App functionality                   |
| Diagnostics → Crash data, performance data | Sentry                                           | No                 | No                | App functionality                   |
| Other → Feedback text the player types     | PostHog                                          | No                 | No                | Product personalisation / analytics |

No names, emails, contacts, location, photos or health data are collected.

## Age rating

Answer **None** to every content question (no violence, gambling, horror, mature themes; no
user-generated content; no unrestricted web access; contests: none). Declare that the app
**contains ads**. The expected rating is **4+**. Do not put the game in the Kids category:
third-party ads are effectively not allowed there.

## Pages

`docs/store/privacy-policy.md` and `docs/store/support.md` are ready to publish on your own site;
put their URLs in App Store Connect and in `src/content/links.json`.
