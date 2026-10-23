// Composites raw captures onto backgrounds with a headline and exports 1320 × 2868 PNGs.
//   npm run store:composite
// Backgrounds: assets-src/store/backgrounds/<save>.png or background.png (Magnific art). Without
// them a generated sky-to-sand gradient with dunes is used.
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { STORE_SAVES } from './make-saves.ts'

const root = resolve(import.meta.dirname, '../..')
const rawDir = join(root, 'store/raw')
const outDir = join(root, 'store/screenshots')
const bgDir = join(root, 'assets-src/store/backgrounds')

const W = 1320
const H = 2868

export const HEADLINES: Record<(typeof STORE_SAVES)[number], string> = {
  first_minute: 'Build a solar charging empire',
  evening_rush: 'Beat the evening rush',
  night_station: 'Store the sun for the night',
  sandstorm: 'Survive the sandstorm',
  map_complete: 'Hire staff and go idle',
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Splits a headline into at most two balanced lines. */
export function wrapHeadline(text: string, maxChars = 18): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  let best: [string, string] = [text, '']
  let bestDiff = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const diff = Math.abs(a.length - b.length)
    if (diff < bestDiff) {
      bestDiff = diff
      best = [a, b]
    }
  }
  return best
}

function generatedBackground(): Buffer {
  const dunes = [0, 1, 2]
    .map((i) => {
      const y = 2380 + i * 150
      const c = ['#E3C78F', '#D9B97C', '#CCA86A'][i]
      return `<path d="M0 ${y} C 300 ${y - 120}, 600 ${y + 80}, 900 ${y - 40} S 1320 ${y - 60}, 1320 ${y} L1320 ${H} L0 ${H} Z" fill="${c}"/>`
    })
    .join('')
  const panels = [
    [130, 520, -14],
    [1150, 760, 12],
    [90, 1900, 10],
    [1190, 2050, -10],
  ]
    .map(
      ([x, y, r]) =>
        `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-70" y="-45" width="140" height="90" rx="10" fill="#1E3557"/><path d="M-23 -45 V45 M23 -45 V45 M-70 0 H70" stroke="#8FC8F0" stroke-width="5"/></g>`,
    )
    .join('')
  const coins = [
    [210, 1320],
    [1100, 1500],
    [160, 2250],
    [1200, 1120],
  ]
    .map(
      ([x, y]) =>
        `<circle cx="${x}" cy="${y}" r="38" fill="#F7C948" stroke="#E0A92E" stroke-width="8"/><path d="M${x! - 6} ${y! - 20} L${x! + 10} ${y! - 2} L${x! - 2} ${y! + 2} L${x! + 6} ${y! + 20}" stroke="#1E3557" stroke-width="7" fill="none" stroke-linejoin="round"/>`,
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7DBDEB"/><stop offset="0.55" stop-color="#CFE9F7"/><stop offset="1" stop-color="#E9D8B4"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${dunes}${panels}${coins}
  </svg>`
  return Buffer.from(svg)
}

function headlineSvg(text: string): Buffer {
  const lines = wrapHeadline(text)
  const size = 118
  const y0 = 250
  const tspans = lines
    .map(
      (l, i) =>
        `<text x="${W / 2}" y="${y0 + i * (size + 22)}" text-anchor="middle">${escape(l)}</text>`,
    )
    .join('')
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <g font-family="SF Pro Rounded, Nunito, Arial Rounded MT Bold, Helvetica, sans-serif" font-weight="800" font-size="${size}">
      <g fill="#1E3557" opacity="0.18" transform="translate(0 8)">${tspans}</g>
      <g fill="#FFFFFF" stroke="#1E3557" stroke-width="10" paint-order="stroke">${tspans}</g>
    </g>
  </svg>`)
}

async function phone(capture: string): Promise<{ buffer: Buffer; width: number; height: number }> {
  const width = Math.round(W * 0.76)
  const screen = await sharp(capture)
    .resize({ width, height: Math.round((width * H) / W), fit: 'cover' })
    .toBuffer()
  const meta = await sharp(screen).metadata()
  const h = meta.height!
  const radius = 90
  const mask = Buffer.from(
    `<svg width="${width}" height="${h}"><rect width="${width}" height="${h}" rx="${radius}" ry="${radius}"/></svg>`,
  )
  const rounded = await sharp(screen)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const bezel = 22
  const frame = Buffer.from(`<svg width="${width + bezel * 2}" height="${h + bezel * 2}">
    <rect width="100%" height="100%" rx="${radius + bezel}" fill="#14161A"/>
  </svg>`)
  const buffer = await sharp(frame)
    .composite([{ input: rounded, left: bezel, top: bezel }])
    .png()
    .toBuffer()
  return { buffer, width: width + bezel * 2, height: h + bezel * 2 }
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  let i = 1
  for (const name of STORE_SAVES) {
    const capture = join(rawDir, `${name}.png`)
    if (!existsSync(capture)) {
      console.warn(`missing ${capture}; run npm run store:capture-web or store:capture-sim first`)
      continue
    }
    const bgFile = [join(bgDir, `${name}.png`), join(bgDir, 'background.png')].find(existsSync)
    const background = bgFile
      ? await sharp(bgFile).resize(W, H, { fit: 'cover' }).toBuffer()
      : await sharp(generatedBackground()).png().toBuffer()
    const device = await phone(capture)
    const out = join(outDir, `${i}_${name}.png`)
    await sharp(background)
      .composite([
        // Soft shadow under the phone.
        {
          input: Buffer.from(
            `<svg width="${W}" height="${H}"><rect x="${(W - device.width) / 2 + 10}" y="${H - device.height - 90}" width="${device.width}" height="${device.height}" rx="110" fill="#1E3557" opacity="0.25"/></svg>`,
          ),
          blend: 'over',
        },
        {
          input: device.buffer,
          left: Math.round((W - device.width) / 2),
          top: H - device.height - 110,
        },
        { input: headlineSvg(HEADLINES[name]), left: 0, top: 0 },
      ])
      .png()
      .toFile(out)
    console.log(`store/screenshots/${i}_${name}.png  "${HEADLINES[name]}"`)
    i++
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
