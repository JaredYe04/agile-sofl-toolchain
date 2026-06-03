/**
 * Reference: spawn the Agile-SOFL language server over stdio (Electron main process).
 *
 * Usage:
 *   node scripts/lsp-bridge.mjs
 *
 * In Electron, use child_process.spawn with the same arguments and pipe
 * renderer ↔ main ↔ LSP JSON-RPC over stdio.
 */

import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'language-server',
  'dist',
  'server.js'
)

const child = spawn(process.execPath, [serverPath, '--stdio'], {
  stdio: 'inherit'
})

child.on('exit', (code) => process.exit(code ?? 0))
