import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function resolveParseBridgePath(): string {
  const fromOut = join(app.getAppPath(), 'out/dist/parse-bridge.cjs')
  if (existsSync(fromOut)) return fromOut
  return join(app.getAppPath(), 'dist/parse-bridge.cjs')
}

export function registerParseHandlers(): void {
  // Pre-bundled with esbuild (incl. chevrotain ESM) — see scripts/bundle-parse-bridge.mjs
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { registerParseHandlers: registerBundled } = require(
    resolveParseBridgePath()
  ) as typeof import('./parseBridge')
  registerBundled()
}
