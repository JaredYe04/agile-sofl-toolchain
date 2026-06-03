import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import type { BrowserWindow } from 'electron'
import { frameMessage, parseMessages } from './lspFraming'

const require = createRequire(import.meta.url)

let lspProcess: ChildProcessWithoutNullStreams | null = null
let stdoutBuffer = ''
let running = false
let mainWindow: BrowserWindow | null = null

function resolveServerEntry(): string {
  const pkgRoot = dirname(require.resolve('@agile-sofl/language-server/package.json'))
  return join(pkgRoot, 'dist', 'server.js')
}

export function setLspWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function isLspRunning(): boolean {
  return running && lspProcess !== null
}

export function startLanguageServer(): boolean {
  if (lspProcess) return true

  const serverEntry = resolveServerEntry()
  if (!existsSync(serverEntry)) {
    console.warn('[studio] language server not built; run npm run bundle --workspace @agile-sofl/language-server')
    running = false
    return false
  }

  lspProcess = spawn(process.execPath, [serverEntry, '--stdio'], {
    cwd: dirname(serverEntry),
    stdio: ['pipe', 'pipe', 'inherit']
  })

  running = true
  stdoutBuffer = ''

  lspProcess.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString('utf8')
    const { messages, rest } = parseMessages(stdoutBuffer)
    stdoutBuffer = rest
    for (const msg of messages) {
      mainWindow?.webContents.send('studio:lsp-message', msg)
    }
  })

  lspProcess.on('exit', (code) => {
    console.log('[studio] language server exited', code)
    lspProcess = null
    running = false
    mainWindow?.webContents.send('studio:lsp-status-changed', { running: false })
  })

  console.log('[studio] spawned language server at', serverEntry)
  mainWindow?.webContents.send('studio:lsp-status-changed', { running: true })
  return true
}

export function sendToLanguageServer(jsonBody: string): void {
  if (!lspProcess?.stdin.writable) return
  lspProcess.stdin.write(frameMessage(jsonBody))
}

export function stopLanguageServer(): void {
  if (!lspProcess) return
  lspProcess.kill()
  lspProcess = null
  running = false
}
