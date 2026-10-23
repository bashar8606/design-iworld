// Turns a raw gameplay recording into an App Store preview: 886 × 1920, 25 s, 30 fps, H.264 with a
// silent stereo track, and short caption overlays only (guideline 2.3.4: captures of the app).
//   npm run store:preview -- store/raw/demo.mov     (or demo.webm from store:capture-web --video)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const input = resolve(process.argv[2] ?? join(root, 'store/raw/demo.mov'))
const out = join(root, 'store/preview/preview_886x1920.mp4')
if (!existsSync(input))
  throw new Error(
    `${input} not found; record one with store:capture-sim or store:capture-web --video`,
  )
mkdirSync(join(root, 'store/preview'), { recursive: true })

// Font for the captions; override with CAPTION_FONT=/path/to/font.ttf.
const fontCandidates = [
  process.env.CAPTION_FONT,
  '/System/Library/Fonts/SFNSRounded.ttf',
  '/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf',
  '/Library/Fonts/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
const font = fontCandidates.find((f) => f && existsSync(f))

export const CAPTIONS: [start: number, end: number, text: string][] = [
  [0.5, 5, 'Plug in cars, collect cash'],
  [6, 11, 'Build solar panels'],
  [12, 17.5, 'Store the sun in batteries'],
  [18.5, 24.5, 'Beat the evening rush'],
]

const drawtext = CAPTIONS.map(([start, end, text]) =>
  [
    `drawtext=text='${text.replace(/'/g, "\\'")}'`,
    font ? `fontfile='${font}'` : '',
    'fontsize=50',
    'fontcolor=white',
    'borderw=5',
    'bordercolor=0x1E3557',
    'x=(w-text_w)/2',
    'y=h*0.16',
    `enable='between(t,${start},${end})'`,
  ]
    .filter(Boolean)
    .join(':'),
).join(',')

const video = `[0:v]trim=start=2:duration=25,setpts=PTS-STARTPTS,fps=30,scale=886:1920:force_original_aspect_ratio=increase,crop=886:1920,${drawtext},format=yuv420p[v]`
execFileSync(
  'ffmpeg',
  [
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-f',
    'lavfi',
    '-t',
    '25',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex',
    video,
    '-map',
    '[v]',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-profile:v',
    'high',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-t',
    '25',
    '-movflags',
    '+faststart',
    out,
  ],
  { stdio: 'inherit' },
)
console.log(
  `store/preview/preview_886x1920.mp4${font ? '' : ' (default font: set CAPTION_FONT for nicer captions)'}`,
)
