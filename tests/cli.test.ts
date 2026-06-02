import { describe, it, expect } from 'vitest'
import { execSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bankingPath = join(__dirname, 'fixtures/integration/banking.asfl')
const cli = join(process.cwd(), 'dist/cli.js')

describe('CLI', () => {
  it('check exits 0 on banking fixture', () => {
    execSync(`node "${cli}" check "${bankingPath}"`, { encoding: 'utf8', stdio: 'pipe' })
  })

  it('format produces module text', () => {
    const out = execSync(`node "${cli}" format "${bankingPath}"`, { encoding: 'utf8' })
    expect(out).toContain('module SYSTEM_Banking')
    expect(out).toContain('end_module')
  })

  it('inspect shows module summary', () => {
    const out = execSync(`node "${cli}" inspect "${bankingPath}"`, { encoding: 'utf8' })
    expect(out).toContain('Banking')
    expect(out).toContain('FSF')
  })

  it('inspect --tree shows AST summary', () => {
    const out = execSync(`node "${cli}" inspect "${bankingPath}" --tree`, { encoding: 'utf8' })
    expect(out).toContain('process')
  })

  it('inspect reads from stdin', () => {
    const source = readFileSync(bankingPath, 'utf8')
    const r = spawnSync('node', [cli, 'inspect'], { input: source, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Banking')
  })

  it('parse --json outputs JSON', () => {
    const out = execSync(`node "${cli}" parse "${bankingPath}" --json`, { encoding: 'utf8' })
    expect(out).toContain('"modules"')
  })
})
