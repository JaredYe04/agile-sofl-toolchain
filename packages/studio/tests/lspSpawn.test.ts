import { describe, it, expect, afterEach } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { frameMessage, parseMessages } from '../src/main/lspFraming'

const require = createRequire(import.meta.url)

function resolveServerEntry(): string {
  const pkgRoot = dirname(require.resolve('@agile-sofl/language-server/package.json'))
  return join(pkgRoot, 'dist', 'server.js')
}

describe('lsp spawn integration', () => {
  let proc: ChildProcessWithoutNullStreams | null = null

  afterEach(() => {
    proc?.kill()
    proc = null
  })

  it('bundled server responds to initialize over stdio', async () => {
    const serverEntry = resolveServerEntry()
    const nodeBin = process.env.npm_node_execpath ?? 'node'
    proc = spawn(nodeBin, [serverEntry, '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: dirname(serverEntry)
    })

    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        capabilities: {},
        rootUri: null
      }
    })

    let buffer = ''
    const response = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('LSP initialize timeout')), 15000)

      proc!.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const { messages } = parseMessages(buffer)
        for (const msg of messages) {
          const parsed = JSON.parse(msg) as { id?: number; result?: unknown }
          if (parsed.id === 1 && parsed.result) {
            clearTimeout(timeout)
            resolve(msg)
          }
        }
      })

      proc!.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim()
        if (text) console.error('[lsp test stderr]', text)
      })

      proc!.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout)
          reject(new Error(`LSP exited with code ${code}`))
        }
      })

      proc!.stdin.write(frameMessage(initRequest))
    })

    const parsed = JSON.parse(response) as { result: { capabilities: unknown } }
    expect(parsed.result.capabilities).toBeTruthy()
  }, 25000)
})
