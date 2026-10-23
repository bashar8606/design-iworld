// Captures the five store saves (and a demo recording) from a store build in Chromium, at the
// 6.9-inch iPhone size (440 × 956 points × 3 = 1320 × 2868 pixels).
//   npm run store:capture-web            screenshots → store/raw/*.png
//   npm run store:capture-web -- --video demo recording → store/raw/demo.webm
// Works on any OS; on a Mac, tools/store/capture-sim.sh captures from the iOS simulator instead.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { STORE_SAVES } from './make-saves.ts'

const root = resolve(import.meta.dirname, '../..')
const rawDir = join(root, 'store/raw')
const port = 4180
const video = process.argv.includes('--video')

mkdirSync(rawDir, { recursive: true })
execFileSync('npx', ['vite', 'build', '--outDir', 'dist-store', '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_STORE: '1' },
})
const server = spawn(
  'npx',
  ['vite', 'preview', '--outDir', 'dist-store', '--port', String(port), '--strictPort'],
  {
    cwd: root,
    stdio: 'ignore',
  },
)
await new Promise((r) => setTimeout(r, 2500))

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  // STORE_SOFTWARE_GL=1 renders without a GPU (containers, CI).
  args: [
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    ...(process.env.STORE_SOFTWARE_GL
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : []),
  ],
})
try {
  // Playwright records video at CSS-pixel size, so the recording uses half the preview size at
  // 1x and store:preview scales it up; the simulator path records at full resolution.
  const context = await browser.newContext(
    video
      ? {
          viewport: { width: 443, height: 960 },
          deviceScaleFactor: 1,
          isMobile: true,
          hasTouch: true,
          recordVideo: { dir: rawDir, size: { width: 443, height: 960 } },
        }
      : {
          viewport: { width: 440, height: 956 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
        },
  )
  const page = await context.newPage()
  if (video) {
    await page.goto(`http://localhost:${port}/?store=demo`)
    await page.waitForTimeout(32_000)
    const path = await page.video()?.path()
    await context.close()
    if (path) renameSync(path, join(rawDir, 'demo.webm'))
    console.log('store/raw/demo.webm')
  } else {
    await page.close()
    for (const name of STORE_SAVES) {
      // A fresh page per save, and one retry if the canvas came out blank.
      for (let attempt = 0; attempt < 2; attempt++) {
        const shot = await context.newPage()
        await shot.goto(`http://localhost:${port}/?store=${name}`)
        await shot.waitForTimeout(6000)
        const file = join(rawDir, `${name}.png`)
        const bytes = await shot.screenshot({ path: file })
        await shot.close()
        if (bytes.length > 100_000) break
      }
      console.log(`store/raw/${name}.png`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  server.kill()
}
