import { describe, it, expect } from 'vitest'
import { inspect } from '../../src/cli/report.js'
import { loadFixture } from '../helpers/index'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tokenize } from '../../src/lexer/lexer.js'
import { check, format, walk, parseModule } from '../../src/index.js'
import { isProgramNode, isModuleNode } from '../../src/ast/guards.js'

describe('CLI report', () => {
  it('renders module summary for minimal spec', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const report = inspect(source)
    expect(report.text).toContain('Agile-SOFL Inspect')
    expect(report.text).toContain('Module SYSTEM_Test')
    expect(report.text).toContain('var:')
    expect(report.exitCode).toBe(0)
  })

  it('renders FSF scenarios for banking', () => {
    const source = loadFixture('integration/banking.asfl')
    const report = inspect(source)
    expect(report.text).toContain('FSF scenarios')
    expect(report.text).toContain('others')
    expect(report.text).toContain('process A')
  })

  it('includes token table when requested', () => {
    const source = 'module SYSTEM_T; end_module'
    const report = inspect(source, { tokens: true })
    expect(report.text).toContain('Token stream')
    expect(report.text).toContain('Module')
    expect(report.text).toContain('EndModule')
  })

  it('includes tree when requested', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const report = inspect(source, { tree: true })
    expect(report.text).toContain('program')
    expect(report.text).toContain('module')
  })

  it('reports parse errors', () => {
    const report = inspect('module broken')
    expect(report.exitCode).toBe(1)
    expect(report.diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('outputs AST JSON with fullJson option', () => {
    const source = loadFixture('grammar/module/minimal.asfl')
    const report = inspect(source, { fullJson: true })
    expect(report.text).toContain('"modules"')
    expect(report.text).toContain('"Test"')
  })
})

describe('REPL via CLI', () => {
  const cli = join(process.cwd(), 'dist/cli.js')

  it('exits on :quit', () => {
    const r = spawnSync('node', [cli, 'repl'], {
      input: ':quit\n',
      encoding: 'utf8',
      timeout: 5000
    })
    expect(r.status).toBe(0)
  })

  it('runs :check on one-liner', () => {
    const r = spawnSync('node', [cli, 'repl'], {
      input: ':check module SYSTEM_T; var x: nat; end_module\n:quit\n',
      encoding: 'utf8',
      timeout: 5000
    })
    expect(r.stdout).toContain('SYSTEM_T')
  })
})

describe('API extras', () => {
  it('format and walk traverse function AST', () => {
    const source = `module SYSTEM_T;
function f (x: nat): bool
== undefined
end_function
end_module`
    const { ast } = check(source)
    expect(ast).not.toBeNull()
    if (isProgramNode(ast)) {
      const nodes: string[] = []
      walk(ast, { enterFunction: (n) => nodes.push(n.type) })
      expect(nodes).toContain('function')
      expect(format(source).source).toContain('function f')
    }
  })

  it('parseModule returns single module', () => {
    const { ast } = parseModule('module Foo; end_module')
    expect(isModuleNode(ast)).toBe(true)
  })

  it('tokenize reports unknown characters', () => {
    const r = tokenize('module @invalid')
    expect(r.errors.length).toBeGreaterThan(0)
  })
})
