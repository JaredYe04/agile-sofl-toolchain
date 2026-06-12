/**
 * Monaco ships marked.js with a sourceMappingURL pointing at a missing file.
 * Vite dev logs ENOENT; creating an empty map silences the noise.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const mapPath = resolve(
  root,
  'node_modules/monaco-editor/esm/vs/base/common/marked/marked.umd.js.map'
)

if (!existsSync(mapPath)) {
  writeFileSync(
    mapPath,
    JSON.stringify({ version: 3, sources: [], names: [], mappings: '' })
  )
  console.log('Created monaco marked.umd.js.map stub')
}
