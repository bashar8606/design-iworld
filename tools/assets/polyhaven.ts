// Downloads textures and an HDRI from the Poly Haven API at build time. The game never calls the API.
//
//   npm run assets:polyhaven                 list candidates for each slot (nothing is downloaded)
//   npm run assets:polyhaven -- --download   download the picks in tools/assets/polyhaven.json
//
// Poly Haven assets are CC0. The API requires a unique User-Agent on every request, and the
// credits must say "Textures and HDRIs: Poly Haven (polyhaven.com)" (see src/content/credits.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '../..')
const API = 'https://api.polyhaven.com'
const USER_AGENT = 'SolarOasisAssetTool/1.0'
const picksFile = join(import.meta.dirname, 'polyhaven.json')

interface Slot {
  /** Search terms matched against tags and categories. */
  tags: string[]
  type: 'textures' | 'hdris'
  /** Chosen asset id; null until you pick one from the candidate list. */
  pick: string | null
}

type Picks = Record<string, Slot>

interface AssetSummary {
  name: string
  tags?: string[]
  categories?: string[]
  download_count?: number
  authors?: Record<string, string>
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function score(asset: AssetSummary, tags: string[]): number {
  const words = [...(asset.tags ?? []), ...(asset.categories ?? []), asset.name.toLowerCase()]
  const hits = tags.filter((t) => words.some((w) => w.toLowerCase().includes(t))).length
  return hits * 1e6 + (asset.download_count ?? 0)
}

async function listCandidates(picks: Picks) {
  const cache: Record<string, Record<string, AssetSummary>> = {}
  for (const [slot, def] of Object.entries(picks)) {
    cache[def.type] ??= await api<Record<string, AssetSummary>>(`/assets?t=${def.type}`)
    const ranked = Object.entries(cache[def.type]!)
      .map(([id, a]) => ({ id, a, s: score(a, def.tags) }))
      .sort((x, y) => y.s - x.s)
      .slice(0, 6)
    console.log(
      `\n${slot} (${def.tags.join(', ')})${def.pick ? `  — current pick: ${def.pick}` : ''}`,
    )
    for (const { id, a } of ranked) {
      console.log(`  ${id.padEnd(36)} ${a.name.padEnd(36)} https://polyhaven.com/a/${id}`)
    }
  }
  console.log(`\nSet each "pick" in ${picksFile}, then run with --download.`)
}

type Files = Record<string, Record<string, Record<string, { url: string }>>>

async function downloadPicks(picks: Picks) {
  const textures: Record<string, { color: string; roughness?: string }> = {}
  let hdri: string | null = null
  const credits: { id: string; name: string; authors: string[] }[] = []
  for (const [slot, def] of Object.entries(picks)) {
    if (!def.pick)
      throw new Error(`No pick for "${slot}"; run without --download to see candidates`)
    const id = def.pick
    const dir = join(root, 'assets-src/polyhaven', id)
    mkdirSync(dir, { recursive: true })
    const [info, files] = await Promise.all([
      api<AssetSummary>(`/info/${id}`),
      api<Files>(`/files/${id}`),
    ])
    writeFileSync(
      join(dir, 'asset.json'),
      JSON.stringify({ id, name: info.name, authors: Object.keys(info.authors ?? {}) }, null, 2),
    )
    credits.push({ id, name: info.name, authors: Object.keys(info.authors ?? {}) })

    if (def.type === 'hdris') {
      const url = files.hdri?.['1k']?.hdr?.url
      if (!url) throw new Error(`${id}: no 1k HDR`)
      const data = await download(url)
      writeFileSync(join(dir, `${id}_1k.hdr`), data)
      writeFileSync(join(root, 'public/textures', `${id}_1k.hdr`), data)
      hdri = `textures/${id}_1k.hdr`
      console.log(`${slot}: ${id} (HDRI)`)
      continue
    }
    const maps: Record<string, string> = { color: 'Diffuse', roughness: 'Rough' }
    const out: Record<string, string> = {}
    for (const [key, map] of Object.entries(maps)) {
      const url = files[map]?.['1k']?.jpg?.url ?? files[map]?.['1k']?.png?.url
      if (!url) continue
      const data = await download(url)
      const original = join(dir, `${id}_${key}_1k${url.endsWith('.png') ? '.png' : '.jpg'}`)
      writeFileSync(original, data)
      const webp = `textures/${slot}_${key}.webp`
      await sharp(data)
        .resize(512, 512)
        .webp({ quality: 82 })
        .toFile(join(root, 'public', webp))
      out[key] = webp
    }
    if (!out.color) throw new Error(`${id}: no colour map`)
    textures[slot] = out as { color: string; roughness?: string }
    console.log(`${slot}: ${id} → ${Object.values(out).join(', ')}`)
  }
  const manifest = { source: 'Poly Haven (polyhaven.com), CC0', textures, hdri, assets: credits }
  writeFileSync(join(root, 'src/content/textures.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(
    '\nWrote src/content/textures.json; the game picks the textures up on the next build.',
  )
}

const picks = JSON.parse(readFileSync(picksFile, 'utf8')) as Picks
mkdirSync(join(root, 'public/textures'), { recursive: true })
if (process.argv.includes('--download')) await downloadPicks(picks)
else await listCandidates(picks)
