// Bundles the headless agent harness with `electron` replaced by a stub. Output: packages/studio/.harness/{run,batch}.mjs
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
for (const name of ['run', 'batch']) await build({
  entryPoints: [join(here, `${name}.ts`)],
  outfile: join(here, `../../.harness/${name}.mjs`),
  bundle: true, platform: 'node', format: 'esm', target: 'node18', packages: 'external', logLevel: 'warning',
  plugins: [{ name: 'electron-stub', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: join(here, 'electron-stub.ts') })) } }]
})
