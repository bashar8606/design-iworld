# Solar Oasis: EV Charge Tycoon

A mobile arcade idle tycoon built with React Three Fiber and Capacitor. See `CLAUDE.md` for the
project rules and layout.

## Run in a browser

```sh
npm install
npm run dev
```

## Run on your iPhone from Xcode

You need a Mac with Xcode 26+, an Apple ID, and the iPhone on a USB cable (or the same Wi-Fi after
the first cable run).

1. `npm install`, then `npm run ios`. This builds the web app, copies it into `ios/` and opens
   `ios/App/App.xcodeproj` in Xcode. Xcode resolves the Swift packages on first open.
2. In Xcode, select the **App** target → **Signing & Capabilities**. Tick **Automatically manage
   signing** and pick your team (add your Apple ID under Xcode → Settings → Accounts if none shows).
   If Xcode says the bundle id is taken, change `com.yourname.solaroasis` to something unique in
   both Xcode and `capacitor.config.ts`.
3. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** and restart when
   asked. (It appears after the phone has been connected to Xcode once.)
4. Pick your iPhone in Xcode's device menu at the top and press **Run** (⌘R).
5. With a free Apple ID, the first launch is blocked: on the phone open **Settings → General → VPN &
   Device Management**, trust your developer certificate, then run again. Free-account builds
   expire after 7 days; a paid developer account removes that limit.

After changing web code, run `npm run build && npx cap sync ios` (or `npm run ios`) and press Run
again.

For quick checks without Xcode, `npm run dev` also serves on your LAN: open the Network URL it
prints in Safari on the phone.
