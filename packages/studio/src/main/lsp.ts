import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'

const require = createRequire(import.meta.url)

let lspProcess: ChildProcessWithoutNullStreams | null = null

function resolveServerEntry(): string {
  const pkgRoot = dirname(require.resolve('@agile-sofl/language-server/package.json'))
  return join(pkgRoot, 'dist', 'server.js')
}

export function startLanguageServer(): void {
  if (lspProcess) return

  const serverEntry = resolveServerEntry()
  if (!existsSync(serverEntry)) {
    console.warn('[studio] language server not built; run npm run bundle --workspace @agile-sofl/language-server')
    return
  }

  lspProcess = spawn(process.execPath, [serverEntry, '--stdio'], {
    cwd: dirname(serverEntry),
    stdio: ['pipe', 'pipe', 'inherit']
  })

  lspProcess.on('exit', (code) => {
    console.log('[studio] language server exited', code)
    lspProcess = null
  })

  lspProcess.stdout.on('data', (chunk: Buffer) => {
    const preview = chunk.toString('utf8', 0, 80).replace(/\r?\n/g, ' ')
    console.log('[studio] lsp stdout:', preview)
  })

  console.log('[studio] spawned language server at', serverEntry)
}

export function stopLanguageServer(): void {
  if (!lspProcess) return
  lspProcess.kill()
  lspProcess = null
}
