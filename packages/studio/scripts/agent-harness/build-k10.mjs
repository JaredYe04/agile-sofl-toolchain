// Bundles the k10 reliability probe with `electron` stubbed. Output: packages/studio/.harness/k10.mjs
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const stub = { name: 'electron-stub', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: join(here, 'electron-stub.ts') })) } }
const base = { bundle: true, platform: 'node', format: 'esm', target: 'node18', packages: 'external', logLevel: 'warning', plugins: [stub] }
await build({ ...base, entryPoints: [join(here, 'k10.ts')], outfile: join(here, '../../.harness/k10.mjs') })
await build({ ...base, entryPoints: [join(here, 'k10-ablation.ts')], outfile: join(here, '../../.harness/k10-ablation.mjs') })
