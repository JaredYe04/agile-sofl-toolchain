import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '../../src/index'
import { isProgramNode } from '../../src/ast/guards'

const grammarRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'grammar')

function loadGrammarFixture(relativePath: string): string {
  return readFileSync(join(grammarRoot, relativePath), 'utf-8')
}

function listFixtures(subdir: string, ext = '.asfl'): string[] {
  const dir = join(grammarRoot, subdir)
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => `${subdir}/${f}`)
}

describe('Grammar fixtures - positive', () => {
  const positiveDirs = [
    'modules',
    'types',
    'expressions',
    'predicates',
    'fsf',
    'processes',
    'functions'
  ]

  for (const dir of positiveDirs) {
    for (const rel of listFixtures(dir)) {
      it(`parses ${rel} without errors`, () => {
        const source = loadGrammarFixture(rel)
        const { ast, diagnostics } = parse(source)
        const errors = diagnostics.filter((d) => d.severity === 'error')
        if (errors.length > 0) {
          throw new Error(`${rel}: ${errors.map((e) => e.code).join(', ')}`)
        }
        expect(ast).not.toBeNull()
      })
    }
  }
})

describe('Grammar fixtures - shape checks', () => {
  it('multi-module has parent links', () => {
    const { ast } = parse(loadGrammarFixture('modules/multi-module.asfl'))
    expect(isProgramNode(ast)).toBe(true)
    if (isProgramNode(ast)) {
      expect(ast.modules).toHaveLength(3)
      expect(ast.modules[1].parent?.name).toBe('Root')
      expect(ast.modules[2].parent?.name).toBe('Child')
    }
  })

  it('all-types covers type constructors', () => {
    const { ast } = parse(loadGrammarFixture('types/all-types.asfl'))
    if (isProgramNode(ast)) {
      const kinds = new Set(ast.modules[0].types.map((t) => t.typeExpr.type))
      expect(kinds.has('set_type')).toBe(true)
      expect(kinds.has('seq_type')).toBe(true)
      expect(kinds.has('product_type')).toBe(true)
      expect(kinds.has('union_type')).toBe(true)
      expect(kinds.has('enum_type')).toBe(true)
      expect(kinds.has('map_type')).toBe(true)
      expect(kinds.has('composed_type')).toBe(true)
    }
  })

  it('case-minimal parses case expression', () => {
    const { ast } = parse(loadGrammarFixture('expressions/case-minimal.asfl'))
    if (isProgramNode(ast)) {
      expect(ast.modules[0].functions[0].body?.type).toBe('case_expr')
    }
  })

  it('let-if parses let and if in const', () => {
    const { ast } = parse(loadGrammarFixture('expressions/let-if.asfl'))
    if (isProgramNode(ast)) {
      const v = ast.modules[0].consts[0].value
      expect(v.type).toBe('let_expr')
      if (v.type === 'let_expr') {
        expect(v.body.type).toBe('if_expr')
      }
    }
  })

  it('case-let-if parses case in function', () => {
    const { ast } = parse(loadGrammarFixture('expressions/case-let-if.asfl'))
    if (isProgramNode(ast)) {
      expect(ast.modules[0].functions[0].body?.type).toBe('case_expr')
    }
  })

  it('fsf multi-scenario has informal atom', () => {
    const { ast } = parse(loadGrammarFixture('fsf/multi-scenario.asfl'))
    if (isProgramNode(ast)) {
      const fsf = ast.modules[0].processes[0].body?.fsf
      expect(fsf?.scenarios.length).toBeGreaterThanOrEqual(2)
      const atom = fsf?.scenarios[1]?.test.disjuncts[0]?.atoms[0]
      expect(atom?.type).toBe('informal_text')
    }
  })

  it('keyword-identifiers parse as variable names', () => {
    const { ast } = parse(loadGrammarFixture('expressions/keyword-identifiers.asfl'))
    if (isProgramNode(ast)) {
      const names = ast.modules[0].vars.map((v) => v.variable.name)
      expect(names).toContain('total')
      expect(names).toContain('informal_flag')
      expect(names).toContain('mycomment')
    }
  })
})

describe('Grammar fixtures - negative', () => {
  it('reports error for unclosed module', () => {
    const { diagnostics } = parse(loadGrammarFixture('negative/unclosed-module.asfl'))
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })
})
