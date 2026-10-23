# Ads and purchases (Phase 6)

Everything runs behind `src/platform`: in a browser the ads are short fake "Test ad" screens and
purchases always succeed, so every flow can be tried without a phone. On the iPhone, AdMob and
RevenueCat take over.

## 1. AdMob

1. In AdMob, open the iOS app and create **one rewarded ad unit per placement** plus **one
   interstitial unit**: `solar_boost`, `welcome_back`, `instant_build`, `vip_car`,
   `blackout_rescue`, `daily_chest`, `interstitial`. Separate units make each placement's
   earnings show up separately in AdMob reports.
2. Put the unit ids in `src/content/ads.json` under `ios.placements` and `ios.interstitial`, and
   the AdMob **app id** in `ios.appId` **and** in `ios/App/App/Info.plist`
   (`GADApplicationIdentifier`, currently Google's test id).
3. Run `npm run ios:skadnetwork` on a machine that can reach developers.google.com to fill
   `SKAdNetworkItems` with Google's full list.
4. In AdMob → Privacy & messaging, create a **GDPR** message and a **US states** message. The game
   asks for consent through Google's User Messaging Platform at start-up.

Development builds (`npm run dev`, or `VITE_ADS_TEST=1`) always use Google's test ad units.
Never tap your own live ads.

### What the game does

- Start-up on iOS: consent form (when required) → Apple's tracking prompt, **only from the second
  launch on** and never rewarded → AdMob initialise.
- The game keeps one rewarded ad loaded for the placement that matters most right now (offline
  card → blackout → VIP car → long upgrade → daily chest → Solar Boost) and reloads as soon as
  an ad closes. A placement's button only appears when its ad is loaded.
- Interstitials only after milestone builds (`rules.milestonePads`) or map complete, at most one
  every 3 minutes, never during the tutorial or the player's first 10 minutes, never with
  Remove Ads.
- Game time, rendering and sound pause while any ad is on screen.
- Every ad event (`ad_requested`, `ad_loaded`, `ad_shown`, `ad_rewarded`, `ad_failed`,
  `ad_dismissed`) goes to analytics with its placement.

## 2. App Store Connect products

Create these in-app purchases (Monetization → In-App Purchases). Prices come from the store and
are never hard-coded in the game.

| Product id     | Type           | Price (concept doc) | Grants                                  |
| -------------- | -------------- | ------------------- | --------------------------------------- |
| `remove_ads`   | Non-consumable | $5.99               | `no_ads` entitlement (no interstitials) |
| `starter_pack` | Non-consumable | $1.99               | $2,000 + 60 gems, once                  |
| `income_x2`    | Non-consumable | $9.99               | Permanent 2x income                     |
| `gems_small`   | Consumable     | $0.99               | 80 gems                                 |
| `gems_medium`  | Consumable     | $4.99               | 250 gems                                |
| `gems_large`   | Consumable     | $9.99               | 700 gems                                |

The Pro Pass subscription waits until after the soft launch. Grants live in
`src/content/shop.json`.

## 3. RevenueCat

1. Create the project, add the iOS app and connect App Store Connect (in-app purchase key).
2. Import the six products. Create the entitlement **`no_ads`** and attach `remove_ads` to it.
3. Create an offering **`default`** (make it current) with one package per product.
4. Copy the **public iOS SDK key** into `.env.local` as `VITE_REVENUECAT_IOS_KEY`, then rebuild.
   Without the key the app falls back to the web stub.

Each consumable is granted exactly once: the store's transaction ids and the game's ledger are
saved together with the game, so a purchase interrupted by the app closing is granted on the next
launch, and old consumables are not granted again on a new install. Remove Ads and 2x income
come back through **Restore Purchases** (settings and shop).

## 4. Test with sandbox accounts on a real iPhone

1. App Store Connect → Users and Access → **Sandbox** → add a tester with an email you control
   (it must not be a real Apple ID).
2. On the iPhone: Settings → **Developer** → Sandbox Apple Account → sign in with the tester
   (Developer Mode must be on; see the README).
3. Build and run from Xcode (`npm run ios`, then Run).
4. In the game, open the shop (🛒). Prices should show in your region's currency. Buy
   `gems_small`; the sandbox sheet says "[Environment: Sandbox]". Check the gems arrive once.
5. Force-quit the app **while** the purchase sheet is up, approve the purchase, relaunch: the gems
   arrive once, not twice.
6. Buy `remove_ads`, then delete the app, reinstall from Xcode and tap **Restore purchases** in
   settings: interstitials stay off.
7. Sandbox subscriptions and purchases can be cleared in Settings → Developer → Sandbox Apple
   Account → Manage.

Check each rewarded placement too: with test ads every placement plays Google's test video and
grants its reward exactly once (watch the cash, gems or boost timer).
