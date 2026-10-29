// Bundles the case-study-sim runner with `electron` replaced by the harness stub.
// Output: packages/studio/.harness/case-study-sim.mjs plus copied subjects/fixtures.
import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const studio = join(here, '../..')
const harnessDir = join(studio, 'scripts', 'agent-harness')
const outDir = join(studio, '.harness')
mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: [join(here, 'run.ts')],
  outfile: join(outDir, 'case-study-sim.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  packages: 'external',
  logLevel: 'warning',
  plugins: [
    {
      name: 'electron-stub',
      setup(b) {
        b.onResolve({ filter: /^electron$/ }, () => ({ path: join(harnessDir, 'electron-stub.ts') }))
      }
    }
  ]
})

const assets = join(outDir, 'case-study-sim-assets')
mkdirSync(assets, { recursive: true })
cpSync(join(here, 'subjects.json'), join(assets, 'subjects.json'))
cpSync(join(here, 'fixtures'), join(assets, 'fixtures'), { recursive: true })
console.log(`wrote ${join(outDir, 'case-study-sim.mjs')}`)
