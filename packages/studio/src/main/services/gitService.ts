/**
 * IPC channels for preload wiring:
 * - studio:git-is-repo  → gitIsRepo(rootPath): Promise<boolean>
 * - studio:git-status   → gitStatus(rootPath): Promise<{ isRepo: boolean; files: GitStatusFile[] }>
 * - studio:git-init     → gitInit(rootPath): Promise<{ ok: boolean; error?: string }>
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'

const execFileAsync = promisify(execFile)
const GIT_BIN = process.platform === 'win32' ? 'git.exe' : 'git'

export type GitFileStatus =
  | 'untracked'
  | 'added'
  | 'modified'
  | 'deleted'
  | 'conflicted'
  | 'ignored'
  | 'renamed'

export interface GitStatusFile {
  path: string
  status: GitFileStatus
}

export interface GitStatusResult {
  isRepo: boolean
  files: GitStatusFile[]
}

export interface GitInitResult {
  ok: boolean
  error?: string
}

const CONFLICT_CODES = new Set(['UU', 'AA', 'DD', 'AU', 'UA', 'DU', 'UD'])

function isGitRepo(rootPath: string): boolean {
  if (!rootPath) return false
  try {
    return existsSync(join(rootPath, '.git'))
  } catch {
    return false
  }
}

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

function decodeGitCQuote(inner: string): string {
  let out = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = inner[i + 1]
    if (next === '\\' || next === '"' || next === "'") {
      out += next
      i++
      continue
    }
    if (next === 't') {
      out += '\t'
      i++
      continue
    }
    if (next === 'n') {
      out += '\n'
      i++
      continue
    }
    if (next === 'r') {
      out += '\r'
      i++
      continue
    }
    const oct = inner.slice(i + 1, i + 4)
    if (/^[0-7]{3}$/.test(oct)) {
      out += String.fromCharCode(parseInt(oct, 8))
      i += 3
      continue
    }
    out += next ?? ''
    i++
  }
  return out
}

function unquoteGitPath(raw: string): string {
  const s = raw.trim()
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return decodeGitCQuote(s.slice(1, -1))
  }
  return s
}

function mapXy(xy: string): GitFileStatus | null {
  if (CONFLICT_CODES.has(xy) || xy.includes('U')) return 'conflicted'
  if (xy === '??') return 'untracked'
  if (xy === '!!') return 'ignored'
  if (xy[0] === 'M' || xy[1] === 'M') return 'modified'
  if (xy[0] === 'A' || xy[1] === 'A') return 'added'
  if (xy[0] === 'D' || xy[1] === 'D') return 'deleted'
  if (xy[0] === 'R' || xy[1] === 'R') return 'renamed'
  if (xy[0] === 'C' || xy[1] === 'C') return 'added'
  if (xy[0] === 'T' || xy[1] === 'T') return 'modified'
  return null
}

function parsePorcelain(stdout: string): GitStatusFile[] {
  const files: GitStatusFile[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.length < 3) continue
    const xy = line.slice(0, 2)
    const status = mapXy(xy)
    if (!status) continue
    const rest = line.slice(3)
    const sep = ' -> '
    const sepIdx = rest.indexOf(sep)
    const isRename = xy.includes('R')
    const paths =
      isRename && sepIdx >= 0
        ? [unquoteGitPath(rest.slice(0, sepIdx)), unquoteGitPath(rest.slice(sepIdx + sep.length))]
        : [unquoteGitPath(rest)]
    for (const raw of paths) {
      const path = normalizeRelPath(raw)
      if (!path) continue
      files.push({ path, status })
    }
  }
  return files
}

async function runGit(
  rootPath: string,
  args: string[]
): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(GIT_BIN, args, {
      cwd: rootPath,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
    })
    return { ok: true, stdout: stdout ?? '', stderr: stderr ?? '' }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string }
    return {
      ok: false,
      stdout: typeof e.stdout === 'string' ? e.stdout : '',
      stderr: typeof e.stderr === 'string' ? e.stderr : '',
      error: e.message || String(err)
    }
  }
}

export function registerGitHandlers(): void {
  ipcMain.handle('studio:git-is-repo', (_event, rootPath: string): boolean => {
    try {
      return isGitRepo(typeof rootPath === 'string' ? rootPath : '')
    } catch {
      return false
    }
  })

  ipcMain.handle('studio:git-status', async (_event, rootPath: string): Promise<GitStatusResult> => {
    try {
      const root = typeof rootPath === 'string' ? rootPath : ''
      if (!root || !isGitRepo(root)) return { isRepo: false, files: [] }
      const result = await runGit(root, ['status', '--porcelain=v1', '-uall'])
      if (!result.ok) return { isRepo: true, files: [] }
      return { isRepo: true, files: parsePorcelain(result.stdout) }
    } catch {
      return { isRepo: false, files: [] }
    }
  })

  ipcMain.handle('studio:git-init', async (_event, rootPath: string): Promise<GitInitResult> => {
    try {
      const root = typeof rootPath === 'string' ? rootPath : ''
      if (!root) return { ok: false, error: 'Missing rootPath' }
      const result = await runGit(root, ['init'])
      if (!result.ok) return { ok: false, error: result.error || result.stderr || 'git init failed' }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}
