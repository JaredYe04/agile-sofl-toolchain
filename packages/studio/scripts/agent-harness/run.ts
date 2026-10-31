/**
 * Headless agent CLI entry. Build with build.mjs, then:
 *   node .harness/run.mjs --informal <file.aspec> [--dry-run]
 * Prefer scripts/agent-harness/headless.mjs, which builds and runs this bundle.
 */
import { runCli } from './cli'

const entry = process.argv[1] ?? ''
if (/(?:^|[\\/])run\.(mjs|ts)$/.test(entry)) {
  runCli(process.argv).then((code) => {
    if (code !== 0) process.exit(code)
  })
}
