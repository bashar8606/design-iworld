#!/usr/bin/env bash
# Captures the five store saves and a 30-second demo recording from the iOS simulator (macOS).
#   npm run store:capture-sim
# Needs Xcode. Builds a store build of the app (VITE_STORE=1) for the simulator, installs it on the
# largest iPhone simulator and opens solaroasis://store/<save> deep links.
set -euo pipefail
cd "$(dirname "$0")/../.."

DEVICE="${STORE_DEVICE:-iPhone 16 Pro Max}"
BUNDLE_ID="com.yourname.solaroasis"
RAW="store/raw"
mkdir -p "$RAW"

VITE_STORE=1 npm run build
npx cap sync ios

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -sdk iphonesimulator -destination "platform=iOS Simulator,name=$DEVICE" \
  -derivedDataPath build/ios-sim CODE_SIGNING_ALLOWED=NO build | tail -3
APP_PATH="$(find build/ios-sim/Build/Products -name 'App.app' -maxdepth 3 | head -1)"

xcrun simctl boot "$DEVICE" 2>/dev/null || true
xcrun simctl bootstatus "$DEVICE" -b
# Clean status bar for screenshots: 9:41, full battery and signal.
xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 \
  --cellularBars 4 --wifiBars 3 --dataNetwork wifi
xcrun simctl install booted "$APP_PATH"
xcrun simctl launch booted "$BUNDLE_ID"
sleep 6

for SAVE in first_minute evening_rush night_station sandstorm map_complete; do
  xcrun simctl openurl booted "solaroasis://store/$SAVE"
  sleep 6
  xcrun simctl io booted screenshot "$RAW/$SAVE.png"
  echo "$RAW/$SAVE.png"
done

# Preview: the autopilot plays the evening-rush save while the simulator records.
xcrun simctl openurl booted "solaroasis://store/demo"
sleep 2
xcrun simctl io booted recordVideo --codec=h264 --force "$RAW/demo.mov" &
REC=$!
sleep 30
kill -INT $REC
wait $REC || true
echo "$RAW/demo.mov"
xcrun simctl status_bar booted clear
