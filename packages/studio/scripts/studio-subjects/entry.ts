/**
 * Bundle entry. Build with build.mjs, then:
 *   node .harness/studio-subjects.mjs --help
 * Prefer scripts/studio-subjects/studio-subjects.mjs, which builds and runs this bundle.
 */
import { runCli } from './cli'

runCli(process.argv).then((code) => {
  if (code !== 0) process.exit(code)
})
