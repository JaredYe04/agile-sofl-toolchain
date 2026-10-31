import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const userData = mkdtempSync(join(tmpdir(), 'headless-ud-'))
writeFileSync(join(userData, 'llm-profiles.json'), JSON.stringify({ activeId: null, profiles: [] }))
vi.mock('electron', () => ({ app: { getPath: () => userData, getAppPath: () => userData }, ipcMain: { handle: () => undefined } }))

import { helpText, installKeyRedaction, parseCliArgs, runCli } from '../scripts/agent-harness/cli'
import { argvForStudio } from '../scripts/agent-harness/headless.mjs'
import { conditionNotice, getExperimentConfig } from '../src/main/services/llm/experiment'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..', '..')

const BANNED = [
  /case-study/i,
  /questionnaire/i,
  /exp-freeze/i,
  /B0-auto/,
  /\bB2\b/,
  /\bB0\b/,
  /classroom/,
  /delivery/,
  /subjects\.json/,
  /\bP23\b/,
  /\bP4\b/,
  /blinding/i,
  /participant/i,
  /\boracle\b/i,
  /paper study/i,
  /\bexperiment\b/i
]

function assertGeneric(text: string) {
  for (const pattern of BANNED) expect(text, pattern.source).not.toMatch(pattern)
}

function captureConsole() {
  const out: string[] = []
  const err: string[] = []
  const log = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { out.push(args.map(String).join(' ')) })
  const error = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { err.push(args.map(String).join(' ')) })
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => { err.push(args.map(String).join(' ')) })
  return {
    out,
    err,
    text: () => [...out, ...err].join('\n'),
    restore: () => { log.mockRestore(); error.mockRestore(); warn.mockRestore() }
  }
}

const sample = `# Functions\n\n## Add note\n\nSave a short note.\n\n# Data Resources\n\n## Note\n\nText.\n\n# Constraints\n\n## Non-empty\n\nA note has text.\n`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('headless agent CLI', () => {
  it('help and the CLI readme describe a generic tool', async () => {
    const cap = captureConsole()
    try {
      expect(await runCli(['node', 'run.mjs', '--help'])).toBe(0)
      expect(await runCli(['node', 'run.mjs', '-h'])).toBe(0)
    } finally { cap.restore() }
    const help = cap.out.join('\n')
    expect(help).toContain('--informal')
    expect(help).toContain('--dry-run')
    expect(help).toContain('--max-approvals')
    expect(help).toContain('ECNU_API_KEY')
    expect(help).toContain('hybrid-generation')
    assertGeneric(help)
    assertGeneric(helpText())
    const readme = readFileSync(join(here, '../scripts/agent-harness/README.md'), 'utf8')
    const studio = readFileSync(join(here, '../README.md'), 'utf8')
    const launcher = readFileSync(join(here, '../scripts/agent-harness/headless.mjs'), 'utf8')
    assertGeneric(readme)
    assertGeneric(studio)
    assertGeneric(launcher)
    expect(readme).toContain('headless agent')
    expect(readme).toContain('--dry-run')
  })

  it('rejects unknown flags and an impossible approval cap', async () => {
    const cap = captureConsole()
    try {
      expect(await runCli(['node', 'run.mjs'])).toBe(1)
      expect(await runCli(['node', 'run.mjs', '--systems', 'demo'])).toBe(1)
      expect(await runCli(['node', 'run.mjs', '--informal', 'a.aspec', '--checks', '--no-checks'])).toBe(1)
      expect(await runCli(['node', 'run.mjs', '--informal', 'a.aspec', '--max-approvals', '0'])).toBe(1)
      expect(await runCli(['node', 'run.mjs', '--informal', 'a.aspec', '--skill', 'not-a-skill'])).toBe(1)
    } finally { cap.restore() }
    expect(cap.text()).toMatch(/Missing required option/)
    expect(cap.text()).toMatch(/Unknown option: --systems/)
    expect(cap.text()).not.toMatch(BANNED[0]!)
    const parsed = parseCliArgs(['node', 'run.mjs', '--informal', 'note.aspec', '--no-checks', '--max-approvals', '2', '--skill', 'hybrid-refinement'])
    expect(parsed).toMatchObject({ options: { checks: false, maxApprovals: 2, skillId: 'hybrid-refinement', informal: 'note.aspec' } })
  })

  it('redacts the API key from stdout', () => {
    const secret = 'sk-testtesttesttest'
    let captured = ''
    const real = process.stdout.write.bind(process.stdout)
    process.stdout.write = ((chunk: unknown) => {
      captured += String(chunk)
      return true
    }) as typeof process.stdout.write
    const restore = installKeyRedaction(secret)
    try {
      process.stdout.write(`${secret}\n`)
      expect(captured).toBe('[redacted]\n')
      expect(captured).not.toContain(secret)
    } finally {
      restore()
      process.stdout.write = real as typeof process.stdout.write
    }
  })

  it('refuses a real run when no API key is configured and does not call the network', async () => {
    const prev = process.env.ECNU_API_KEY
    process.env.ECNU_API_KEY = ' '
    const fetchMock = vi.fn(async () => { throw new Error('network must not be used') })
    vi.stubGlobal('fetch', fetchMock)
    const cap = captureConsole()
    try {
      const code = await runCli(['node', 'run.mjs', '--informal', 'missing.aspec', '--out', join(tmpdir(), 'unused')])
      expect(code).toBe(1)
    } finally {
      cap.restore()
      if (prev === undefined) delete process.env.ECNU_API_KEY
      else process.env.ECNU_API_KEY = prev
    }
    expect(cap.err.join('\n')).toMatch(/ECNU_API_KEY is not set/)
    expect(fetchMock).not.toHaveBeenCalled()
    assertGeneric(cap.text())
  })

  it('dry-run writes a hybrid specification without a key or the network', async () => {
    const secret = 'sk-cli-secret-value'
    const prevKey = process.env.ECNU_API_KEY
    process.env.ECNU_API_KEY = secret
    process.env.AGILE_SOFL_HARNESS_USERDATA = userData
    const fetchMock = vi.fn(async () => { throw new Error('network must not be used') })
    vi.stubGlobal('fetch', fetchMock)
    const dir = mkdtempSync(join(tmpdir(), 'headless-dry-'))
    const inf = join(dir, 'note.aspec')
    writeFileSync(inf, sample)
    const out = join(dir, 'out')
    const cap = captureConsole()
    let code = 1
    try {
      code = await runCli([
        'node', 'run.mjs',
        '--informal', inf,
        '--out', out,
        '--dry-run',
        '--task', 'Generate a hybrid specification for notes.',
        '--max-approvals', '4'
      ])
    } finally {
      cap.restore()
      if (prevKey === undefined) delete process.env.ECNU_API_KEY
      else process.env.ECNU_API_KEY = prevKey
    }
    expect(code).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(cap.text()).not.toContain(secret)
    assertGeneric(cap.text())
    expect(cap.err.join('\n')).toMatch(/headless agent/)
    expect(cap.err.join('\n')).not.toMatch(/condition=|participant=/)
    const summary = JSON.parse(cap.out.find((line) => line.startsWith('{'))!)
    expect(summary).toMatchObject({ dryRun: true, checks: true, approvals: 3, stopReason: 'agent finished' })
    expect(summary.promptHash).toMatch(/^[0-9a-f]{12}$/)
    const hybrid = readFileSync(summary.hybrid, 'utf8')
    expect(hybrid).toContain('SYSTEM_DryRun1')
    expect(hybrid).toContain('SYSTEM_DryRun3')
    const manifest = JSON.parse(readFileSync(join(summary.out, 'runs', summary.runId, 'manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({ checks: true, dryRun: true, projectName: 'note', skillId: 'hybrid-generation', approvals: 3 })
    const calls = readFileSync(join(summary.out, 'runs', summary.runId, '.agile-sofl', 'llm-calls.jsonl'), 'utf8')
    expect(calls).not.toContain(secret)
    const start = calls.trim().split('\n').map((line) => JSON.parse(line)).find((row) => row.event === 'session_start')
    expect(start.semanticChecks).toBe(true)
    expect(String(start.warning)).toMatch(/headless agent/)
    expect(String(start.warning)).not.toMatch(/experiment|condition=/)
    const sessDir = join(summary.out, 'runs', summary.runId, '.agile-sofl', 'agent', 'sessions')
    const sessFile = readdirSync(sessDir).find((name) => name.endsWith('.json'))
    expect(readFileSync(join(sessDir, sessFile!), 'utf8')).toContain('Generate a hybrid specification for notes.')
  }, 60000)

  it('dry-run --no-checks leaves semantic checks off and still redacts an env-file key', async () => {
    const secret = 'sk-env-file-secret'
    const prevKey = process.env.ECNU_API_KEY
    delete process.env.ECNU_API_KEY
    const dir = mkdtempSync(join(tmpdir(), 'headless-nocheck-'))
    const inf = join(dir, 'note.aspec')
    writeFileSync(inf, sample)
    const envFile = join(dir, 'llm.env')
    writeFileSync(envFile, `ECNU_API_KEY=${secret}\n`)
    process.env.AGILE_SOFL_HARNESS_USERDATA = userData
    const cap = captureConsole()
    let code = 1
    try {
      code = await runCli([
        'node', 'run.mjs',
        '--informal', inf,
        '--out', join(dir, 'out'),
        '--dry-run',
        '--no-checks',
        '--max-approvals', '1',
        '--env-file', envFile
      ])
    } finally {
      cap.restore()
      if (prevKey === undefined) delete process.env.ECNU_API_KEY
      else process.env.ECNU_API_KEY = prevKey
    }
    expect(code).toBe(0)
    expect(cap.text()).not.toContain(secret)
    expect(cap.err.join('\n')).toMatch(/semantic checks are off/)
    const summary = JSON.parse(cap.out.find((line) => line.startsWith('{'))!)
    expect(summary).toMatchObject({ checks: false, dryRun: true, approvals: 1, stopReason: 'approval budget reached' })
    const calls = readFileSync(join(summary.out, 'runs', summary.runId, '.agile-sofl', 'llm-calls.jsonl'), 'utf8')
    expect(calls).not.toContain(secret)
    const start = calls.trim().split('\n').map((line) => JSON.parse(line)).find((row) => row.event === 'session_start')
    expect(start.semanticChecks).toBe(false)
  }, 60000)

  it('headless notice does not name an internal mode label', () => {
    const prev = process.env.AGILE_SOFL_HEADLESS
    process.env.AGILE_SOFL_HEADLESS = '1'
    try {
      const on = conditionNotice(getExperimentConfig(undefined, {}))
      const off = conditionNotice(getExperimentConfig(undefined, { AGILE_SOFL_CONDITION: 'B2' }))
      expect(on).toMatch(/parser and semantic checks are fed back/)
      expect(off).toMatch(/semantic checks are off/)
      assertGeneric(on)
      assertGeneric(off)
    } finally {
      if (prev === undefined) delete process.env.AGILE_SOFL_HEADLESS
      else process.env.AGILE_SOFL_HEADLESS = prev
    }
  })

  it('resolves file options from the caller directory', () => {
    expect(argvForStudio(
      ['--informal', 'note.aspec', '--out', 'out', '--task', 'keep relative', '--dry-run'],
      '/tmp/specs'
    )).toEqual([
      '--informal', '/tmp/specs/note.aspec',
      '--out', '/tmp/specs/out',
      '--task', 'keep relative',
      '--dry-run'
    ])
  })

  it('launcher --help exits 0 and stays generic', () => {
    const res = spawnSync(process.execPath, [join(repo, 'packages/studio/scripts/agent-harness/headless.mjs'), '--help'], {
      cwd: repo,
      encoding: 'utf8',
      timeout: 120000
    })
    expect(res.status, res.stderr).toBe(0)
    expect(res.stdout).toContain('headless agent CLI')
    expect(res.stdout).toContain('--dry-run')
    assertGeneric(res.stdout)
  }, 120000)
})
