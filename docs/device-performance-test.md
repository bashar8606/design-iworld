# iPhone performance test (Phase 4A)

The engine decision on 15 Nov depends on this test: the full map 1 layout must keep its p95
frame time under 20 ms on an iPhone that is 3–4 years old (iPhone 12 or 13).

## What the stress mode loads

`?stress=1` builds every map 1 pad at night, adds a 100-row solar farm, fills the batteries and
sends cars in fast enough to keep about 30 on screen, with 6 chargers and their cables, the café,
staff and the worker. The camera zooms out so everything is on screen at once.

Measured in a desktop browser (renderer.info): **36 draw calls and about 48,000 triangles**,
against a budget of 100 draw calls and 150,000 triangles. Frame times can only be measured on the
device.

On the device the game caps the pixel ratio at 2 and turns real-time shadows off; one baked
contact shadow and blob shadows under cars and people replace them. Add `&shadows=1` to compare.

## Run it on the iPhone

Inside the iOS app there is no address bar for `?stress=1`, so stress mode can also be switched
on from the game's hidden debug menu.

1. On the Mac: `npm install`, then `npm run ios`. Xcode opens the project.
2. Pick the iPhone in the device menu and press **Run** (⌘R).
3. In the game, tap the day-night clock five times quickly to open the debug menu and choose
   **Stress test**. The app reloads into the stress layout with the performance overlay showing
   (a three-finger tap toggles the overlay).
4. Leave the phone on the table, screen on, for at least 2 minutes.
5. To go back to the normal game, open the debug menu again and choose **Leave stress test**.

## Read the console summary

Every 60 seconds the game logs a line like this:

```
[perf] 60 s summary: 59.8 fps, frame time p50 16.6 ms, p95 18.9 ms, peak 36 draw calls, 48,212 triangles, 3588 frames
```

- In Xcode: the debug area at the bottom (View → Debug Area → Activate Console) shows it.
- Or in Safari on the Mac: Develop → your iPhone → the app's web view → Console.

Note the second and later summaries (the first includes loading). The test passes when p95 stays
under 20 ms.

## If p95 is over 20 ms

Profile in Safari's Web Inspector (Timelines → JavaScript & Events and Rendering Frames) and
check these in order of likely impact:

1. **Fill rate.** Drop the pixel ratio cap to 1.5 (`quality.maxDpr`) and the contact shadow
   resolution to 256. Fill rate is the usual limit on older iPhones at 3x screens.
2. **Per-frame JavaScript.** The car, pickup and ring updates rebuild instance matrices every
   frame; skip unchanged instances and update the panel tint less often (it already runs at 5 Hz).
3. **Materials.** Replace `MeshStandardMaterial` with `MeshLambertMaterial` for the vertex-coloured
   props and turn off the environment map; panels keep standard material for their glints.

Record the result in the 15 Nov decision table in the build plan.
