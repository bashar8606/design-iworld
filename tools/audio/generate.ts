// Synthesizes the game's sound effects and loops, then encodes them to MP3 with ffmpeg.
//   npm run audio:generate
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const RATE = 44100
const root = resolve(import.meta.dirname, '../..')
const outDir = join(root, 'public/audio')

type Wave = (phase: number) => number
const sine: Wave = (p) => Math.sin(2 * Math.PI * p)
const triangle: Wave = (p) => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25))
const square: Wave = (p) => (p % 1 < 0.5 ? 1 : -1)

let seed = 1
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1

function buffer(seconds: number) {
  return new Float32Array(Math.round(seconds * RATE))
}

/** Adds a note with an attack/decay envelope. */
function note(
  out: Float32Array,
  start: number,
  freq: number,
  length: number,
  gain: number,
  wave: Wave = sine,
  attack = 0.005,
) {
  const s0 = Math.round(start * RATE)
  const n = Math.round(length * RATE)
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const t = i / RATE
    const env = Math.min(1, t / attack) * Math.exp((-4 * t) / length)
    out[s0 + i]! += wave(freq * t) * env * gain
  }
}

function lowpass(data: Float32Array, amount: number) {
  let y = 0
  for (let i = 0; i < data.length; i++) {
    y += amount * (data[i]! - y)
    data[i] = y
  }
}

function normalize(data: Float32Array, peak = 0.85) {
  const max = data.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1
  for (let i = 0; i < data.length; i++) data[i] = (data[i]! / max) * peak
}

/** Fades the ends so loops join without clicks. */
function loopFade(data: Float32Array, seconds = 0.05) {
  const n = Math.round(seconds * RATE)
  for (let i = 0; i < n; i++) {
    data[i]! *= i / n
    data[data.length - 1 - i]! *= i / n
  }
}

function wav(data: Float32Array): Buffer {
  const out = Buffer.alloc(44 + data.length * 2)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + data.length * 2, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(RATE, 24)
  out.writeUInt32LE(RATE * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++)
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i]!)) * 32767), 44 + i * 2)
  return out
}

const sounds: Record<string, () => Float32Array> = {
  cash: () => {
    const d = buffer(0.35)
    note(d, 0, 1318.5, 0.12, 0.6, triangle)
    note(d, 0.07, 1975.5, 0.25, 0.6, triangle)
    note(d, 0.07, 3951, 0.15, 0.15, sine)
    return d
  },
  build: () => {
    const d = buffer(0.9)
    ;[523.3, 659.3, 784, 1046.5].forEach((f, i) => note(d, i * 0.07, f, 0.5, 0.45, triangle))
    note(d, 0.3, 2093, 0.5, 0.2, sine)
    note(d, 0, 130.8, 0.5, 0.4, sine, 0.01)
    return d
  },
  car_arrive: () => {
    const d = buffer(0.9)
    for (let i = 0; i < d.length; i++) {
      const t = i / RATE
      const env = Math.sin(Math.PI * Math.min(1, t / 0.9))
      // Electric whine sliding down plus soft tyre noise.
      d[i] = (sine((600 - 250 * t) * t) * 0.25 + noise() * 0.15) * env
    }
    lowpass(d, 0.2)
    return d
  },
  car_angry: () => {
    const d = buffer(0.6)
    note(d, 0, 392, 0.18, 0.5, square, 0.01)
    note(d, 0.22, 311, 0.3, 0.5, square, 0.01)
    lowpass(d, 0.25)
    return d
  },
  night: () => {
    const d = buffer(8)
    for (let i = 0; i < d.length; i++) d[i] = noise() * 0.08
    lowpass(d, 0.01)
    // Crickets: short high chirps in little bursts.
    for (let k = 0; k < 26; k++) {
      const start = (k * 0.31 + (k % 3) * 0.9) % 7.6
      for (let c = 0; c < 3; c++)
        note(d, start + c * 0.045, 4200 + (k % 4) * 180, 0.035, 0.12, sine, 0.002)
    }
    loopFade(d)
    return d
  },
  music: () => {
    // Four bars of soft chords and a plucked melody at 84 bpm.
    const beat = 60 / 84
    const d = buffer(beat * 16)
    const chords = [
      [261.6, 329.6, 392, 493.9],
      [220, 261.6, 329.6, 392],
      [174.6, 220, 261.6, 329.6],
      [196, 246.9, 293.7, 392],
    ]
    chords.forEach((chord, bar) => {
      for (const f of chord) note(d, bar * 4 * beat, f, 4 * beat, 0.12, triangle, 0.3)
      note(d, bar * 4 * beat, chord[0]! / 2, 4 * beat, 0.18, sine, 0.05)
    })
    const melody = [
      659.3, 784, 880, 784, 659.3, 587.3, 523.3, 587.3, 659.3, 523.3, 440, 523.3, 587.3, 493.9, 392,
      493.9,
    ]
    melody.forEach((f, i) => note(d, i * beat, f, beat * 0.9, 0.16, triangle))
    lowpass(d, 0.35)
    loopFade(d, 0.02)
    return d
  },
}

const tmp = mkdtempSync(join(tmpdir(), 'solar-audio-'))
try {
  for (const [name, make] of Object.entries(sounds)) {
    const data = make()
    normalize(data, name === 'night' || name === 'music' ? 0.6 : 0.85)
    const file = join(tmp, `${name}.wav`)
    writeFileSync(file, wav(data))
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-y',
      '-i',
      file,
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '5',
      join(outDir, `${name}.mp3`),
    ])
    console.log(`public/audio/${name}.mp3  ${(data.length / RATE).toFixed(2)} s`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
