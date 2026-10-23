// assets:check — fails when a model in public/models is over its triangle or draw-call limit in
// src/content/assets.json, or has no entry there. Runs before every build.
import { readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import assets from '../../src/content/assets.json'

const root = resolve(import.meta.dirname, '../..')
const modelsDir = join(root, 'public/models')
type ModelEntry = { route: string; triangleLimit: number; drawCallLimit: number }
const limits = assets.models as Record<string, ModelEntry>

export async function measure(path: string) {
  await MeshoptDecoder.ready
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
  const doc = await io.read(path)
  let triangles = 0
  let drawCalls = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      drawCalls += 1
      const indices = prim.getIndices()
      const count = indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0)
      if (prim.getMode() === 4) triangles += count / 3
    }
  }
  return { triangles, drawCalls }
}

async function main() {
  const files = readdirSync(modelsDir).filter((f) => f.endsWith('.glb'))
  const problems: string[] = []
  for (const file of files) {
    const name = basename(file, '.glb')
    const entry = limits[name]
    const { triangles, drawCalls } = await measure(join(modelsDir, file))
    const status = !entry
      ? 'missing from assets.json'
      : triangles > entry.triangleLimit
        ? `over ${entry.triangleLimit} triangles`
        : drawCalls > entry.drawCallLimit
          ? `over ${entry.drawCallLimit} draw calls`
          : 'ok'
    console.log(
      `${name.padEnd(14)} ${String(triangles).padStart(6)} tris ${String(drawCalls).padStart(3)} draws  ${entry?.route ?? '?'}  ${status}`,
    )
    if (status !== 'ok') problems.push(`${name}: ${status}`)
  }
  if (problems.length > 0) {
    console.error(`\nAsset budget check failed:\n  ${problems.join('\n  ')}`)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
