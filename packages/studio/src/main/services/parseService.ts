import { join } from 'node:path'

// Pre-bundled with esbuild (incl. chevrotain ESM) — see scripts/bundle-parse-bridge.mjs
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { registerParseHandlers: registerBundled } = require(
  join(__dirname, '../../dist/parse-bridge.cjs')
) as typeof import('./parseBridge')

export function registerParseHandlers(): void {
  registerBundled()
}
