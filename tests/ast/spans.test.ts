import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '../../src/index'
import type { Span } from '../../src/ast/span'
import { isProgramNode } from '../../src/ast/guards'

const grammarRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'grammar')

function expectSpanCovers(source: string, span: Span, substring: string) {
  expect(span.end).toBeGreaterThan(span.start)
  expect(source.slice(span.start, span.end)).toContain(substring)
}

describe('AST spans', () => {
  it('module SYSTEM_Traps has non-empty span covering name', () => {
    const source = 'module SYSTEM_Traps;\nvar total: nat;\nend_module'
    const { ast } = parse(source)
    const mod = ast!.modules[0]
    expectSpanCovers(source, mod.span, 'SYSTEM_Traps')
    expectSpanCovers(source, ast!.modules[0].vars[0].variable.span, 'total')
  })

  it('type and const declarations have name spans', () => {
    const source = 'module SYSTEM_S;\nconst c = 1;\ntype T = nat;\nend_module'
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      expectSpanCovers(source, ast.modules[0].types[0].span, 'T')
      expectSpanCovers(source, ast.modules[0].consts[0].span, 'c')
    }
  })

  it('process name span covers declaration', () => {
    const source = 'module SYSTEM_S;\nprocess Worker ()\nFSF :\nothers && true\nend_process\nend_module'
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      expect(ast.modules[0].processes[0].span.end).toBeGreaterThan(ast.modules[0].processes[0].span.start)
    }
  })

  it('grammar fixtures give non-empty spans for named symbols', () => {
    const positiveDirs = ['modules', 'types', 'expressions', 'processes', 'functions']
    for (const dir of positiveDirs) {
      const dirPath = join(grammarRoot, dir)
      for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.asfl'))) {
        const source = readFileSync(join(dirPath, file), 'utf-8')
        const { ast } = parse(source)
        if (!isProgramNode(ast)) continue
        const mod = ast.modules[0]
        for (const v of mod.vars) {
          expect(v.variable.span.end, `${file} var ${v.variable.name}`).toBeGreaterThan(v.variable.span.start)
        }
        for (const t of mod.types) {
          expect(t.span.end, `${file} type ${t.name}`).toBeGreaterThan(t.span.start)
        }
        for (const p of mod.processes) {
          expect(p.span.end, `${file} process ${p.name}`).toBeGreaterThan(p.span.start)
        }
      }
    }
  })
})
