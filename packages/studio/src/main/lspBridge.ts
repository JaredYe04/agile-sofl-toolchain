import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { utilityProcess, type BrowserWindow, type UtilityProcess } from 'electron'
import { frameMessage, parseMessages } from './lspFraming'

const require = createRequire(import.meta.url)

type LspHandle =
  | { kind: 'child'; proc: ChildProcessWithoutNullStreams }
  | { kind: 'utility'; proc: UtilityProcess }

let lspHandle: LspHandle | null = null
let stdoutBuffer = ''
let running = false
let statusMessage = ''
let mainWindow: BrowserWindow | null = null
let readyTimer: ReturnType<typeof setTimeout> | null = null
let markedReady = false
let isShuttingDown = false

function canSendToRenderer(): boolean {
  return (
    !isShuttingDown &&
    mainWindow !== null &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed()
  )
}

function safeSend(channel: string, ...args: unknown[]): void {
  if (!canSendToRenderer()) return
  mainWindow!.webContents.send(channel, ...args)
}

function resolveServerEntry(): string {
  const pkgRoot = dirname(require.resolve('@agile-sofl/language-server/package.json'))
  return join(pkgRoot, 'dist', 'server.js')
}

export function setLspWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function isLspRunning(): boolean {
  return running && lspHandle !== null
}

export function getLspStatusMessage(): string {
  return statusMessage
}

function broadcastStatus(runningNow: boolean, message?: string): void {
  running = runningNow
  if (message !== undefined) statusMessage = message
  safeSend('studio:lsp-status-changed', {
    running: runningNow,
    message: statusMessage
  })
}

function clearReadyTimer(): void {
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = null
  }
}

function markRunningReady(): void {
  if (markedReady || !lspHandle) return
  markedReady = true
  clearReadyTimer()
  statusMessage = 'Language server connected'
  broadcastStatus(true)
}

function scheduleReadyFallback(): void {
  clearReadyTimer()
  readyTimer = setTimeout(() => {
    if (lspHandle && !markedReady) markRunningReady()
  }, 300)
}

function attachStdout(onData: (chunk: Buffer) => void): void {
  if (!lspHandle) return
  if (lspHandle.kind === 'child') {
    lspHandle.proc.stdout.on('data', onData)
  } else {
    lspHandle.proc.stdout?.on('data', onData)
  }
}

function attachStderr(onData: (chunk: Buffer) => void): void {
  if (!lspHandle) return
  if (lspHandle.kind === 'child') {
    lspHandle.proc.stderr.on('data', onData)
  } else {
    lspHandle.proc.stderr?.on('data', onData)
  }
}

function attachExit(onExit: (code: number | null) => void): void {
  if (!lspHandle) return
  if (lspHandle.kind === 'child') {
    lspHandle.proc.on('exit', onExit)
  } else {
    lspHandle.proc.on('exit', onExit)
  }
}

function writeStdin(data: string): void {
  if (!lspHandle) return
  if (lspHandle.kind === 'child') {
    if (lspHandle.proc.stdin.writable) lspHandle.proc.stdin.write(data)
  } else {
    lspHandle.proc.stdin?.write(data)
  }
}

function killHandle(): void {
  if (!lspHandle) return
  if (lspHandle.kind === 'child') lspHandle.proc.kill()
  else lspHandle.proc.kill()
}

function wireProcess(label: string): boolean {
  if (!lspHandle) return false

  stdoutBuffer = ''
  markedReady = false
  let stderrBuf = ''

  attachStdout((chunk: Buffer) => {
    if (!markedReady) markRunningReady()
    stdoutBuffer += chunk.toString('utf8')
    const { messages, rest } = parseMessages(stdoutBuffer)
    stdoutBuffer = rest
    for (const msg of messages) {
      safeSend('studio:lsp-message', msg)
    }
  })

  attachStderr((chunk: Buffer) => {
    stderrBuf += chunk.toString('utf8')
    const text = chunk.toString('utf8').trim()
    if (text) console.error(`[studio] lsp stderr (${label}):`, text)
  })

  attachExit((code) => {
    clearReadyTimer()
    if (!isShuttingDown) {
      console.error(`[studio] language server exited (${label})`, code)
      if (stderrBuf.trim()) console.error('[studio] lsp stderr summary:', stderrBuf.trim().slice(0, 500))
    }
    lspHandle = null
    markedReady = false
    if (isShuttingDown) return
    const hint =
      stderrBuf.trim().slice(0, 200) ||
      'Run: npm run bundle --workspace @agile-sofl/language-server'
    statusMessage = `Language server failed (${label}): ${hint}`
    broadcastStatus(false)
  })

  scheduleReadyFallback()
  console.log(`[studio] spawned language server via ${label}`)
  return true
}

function tryUtilityProcess(serverEntry: string): boolean {
  try {
    const proc = utilityProcess.fork(serverEntry, ['--stdio'], {
      serviceName: 'agile-sofl-lsp',
      stdio: 'pipe',
      cwd: dirname(serverEntry)
    })
    lspHandle = { kind: 'utility', proc }
    return wireProcess('utilityProcess')
  } catch (err) {
    console.warn('[studio] utilityProcess.fork failed:', err)
    lspHandle = null
    return false
  }
}

function tryNodeSpawn(serverEntry: string): boolean {
  const nodeBin = process.env.npm_node_execpath ?? 'node'
  try {
    const proc = spawn(nodeBin, [serverEntry, '--stdio'], {
      cwd: dirname(serverEntry),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    lspHandle = { kind: 'child', proc }
    return wireProcess('node')
  } catch (err) {
    console.warn('[studio] node spawn failed:', err)
    lspHandle = null
    return false
  }
}

function tryElectronAsNode(serverEntry: string): boolean {
  try {
    const proc = spawn(process.execPath, [serverEntry, '--stdio'], {
      cwd: dirname(serverEntry),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    lspHandle = { kind: 'child', proc }
    return wireProcess('electron-as-node')
  } catch (err) {
    console.warn('[studio] electron-as-node spawn failed:', err)
    lspHandle = null
    return false
  }
}

export function startLanguageServer(): boolean {
  if (lspHandle) return isLspRunning()

  isShuttingDown = false
  const serverEntry = resolveServerEntry()
  if (!existsSync(serverEntry)) {
    statusMessage =
      'Language server not built — run: npm run bundle --workspace @agile-sofl/language-server'
    console.warn('[studio]', statusMessage)
    broadcastStatus(false)
    return false
  }

  const strategies = [
    () => tryNodeSpawn(serverEntry),
    () => tryElectronAsNode(serverEntry),
    () => tryUtilityProcess(serverEntry)
  ]

  for (const strategy of strategies) {
    if (strategy()) return true
  }

  statusMessage = 'Failed to spawn language server with all strategies'
  broadcastStatus(false)
  return false
}

export function sendToLanguageServer(jsonBody: string): void {
  writeStdin(frameMessage(jsonBody))
}

export function stopLanguageServer(): void {
  isShuttingDown = true
  clearReadyTimer()
  if (!lspHandle) return
  killHandle()
  lspHandle = null
  running = false
  markedReady = false
}

export function resetLspShutdownState(): void {
  isShuttingDown = false
}
