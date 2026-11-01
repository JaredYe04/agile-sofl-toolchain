// Bundles the Studio subject runner. `electron` is replaced only so main-process
// modules (env.ts, profiles.ts) can load outside a BrowserWindow. Decisions are
// not made by this stub.
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stub = join(here, '..', 'agent-harness', 'electron-stub.ts')
await build({
  entryPoints: [join(here, 'entry.ts')],
  outfile: join(here, '../../.harness/studio-subjects.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  packages: 'external',
  logLevel: 'warning',
  plugins: [
    {
      name: 'electron-import-stub',
      setup(build) {
        build.onResolve({ filter: /^electron$/ }, () => ({ path: stub }))
      }
    }
  ]
})
