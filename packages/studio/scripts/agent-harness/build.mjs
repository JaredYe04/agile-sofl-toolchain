// Bundles the headless agent harness with `electron` replaced by a stub.
// Output: packages/studio/.harness/{run,batch,study-a-run,study-a-list,study-a}.mjs
// study-a.mjs is a dispatcher: --list loads only the gold loader, not the agent loop.
import { writeFileSync } from 'node:fs'
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const harnessOut = join(here, '../../.harness')
const plugin = { name: 'electron-stub', setup(b) { b.onResolve({ filter: /^electron$/ }, () => ({ path: join(here, 'electron-stub.ts') })) } }
const common = { bundle: true, platform: 'node', format: 'esm', target: 'node18', packages: 'external', logLevel: 'warning', plugins: [plugin] }
for (const name of ['run', 'batch']) await build({
  entryPoints: [join(here, `${name}.ts`)],
  outfile: join(harnessOut, `${name}.mjs`),
  ...common
})
await build({ entryPoints: [join(here, 'study-a.ts')], outfile: join(harnessOut, 'study-a-run.mjs'), ...common })
await build({ entryPoints: [join(here, 'studyAListMain.ts')], outfile: join(harnessOut, 'study-a-list.mjs'), ...common })
writeFileSync(join(harnessOut, 'study-a.mjs'), `import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const target = process.argv.includes('--list') ? 'study-a-list.mjs' : 'study-a-run.mjs'
await import(pathToFileURL(join(here, target)).href)
`)
