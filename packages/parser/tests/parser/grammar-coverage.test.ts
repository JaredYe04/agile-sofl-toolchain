import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { check, parse, parseStrict } from '../../src/index'
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

  it('fsf-before-body attaches FSF before function body', () => {
    const { ast } = parse(loadGrammarFixture('functions/fsf-before-body.asfl'))
    if (isProgramNode(ast)) {
      const guarded = ast.modules[0].functions.find((f) => f.name === 'guarded')
      expect(guarded?.fsf?.others).toBeDefined()
      expect(guarded?.fsf?.scenarios).toHaveLength(0)
      expect(guarded?.body?.type).toBe('identifier')
      expect(ast.modules[0].functions).toHaveLength(1)
    }
  })

  it('comprehension-types covers set seq and map comprehensions', () => {
    const source = loadGrammarFixture('expressions/comprehension-types.asfl')
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      const comps: string[] = []
      const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') return
        const n = node as { type?: string; kind?: string }
        if (n.type === 'set_expr' && n.kind === 'comprehension') comps.push('set')
        if (n.type === 'seq_expr' && n.kind === 'comprehension') comps.push('seq')
        if (n.type === 'map_expr' && n.kind === 'comprehension') comps.push('map')
        for (const value of Object.values(node as object)) {
          if (Array.isArray(value)) value.forEach(visit)
          else if (value && typeof value === 'object') visit(value)
        }
      }
      visit(ast)
      expect(ast.modules[0].processes).toHaveLength(3)
      expect(comps).toEqual(expect.arrayContaining(['set', 'seq', 'map']))
      expect(source).toMatch(/\{ n \| n: nat/)
      expect(source).toMatch(/\[\s*i \| i: int/)
    }
  })

  it('const-expr allows binary expressions in const initializers', () => {
    const { ast } = parse(loadGrammarFixture('modules/const-expr.asfl'))
    if (isProgramNode(ast)) {
      const offset = ast.modules[0].consts.find((c) => c.name === 'offset')
      expect(offset?.value.type).toBe('binary_op')
    }
  })

  it('map-comprehension parses map literals and comprehensions in const and FSF', () => {
    const source = loadGrammarFixture('expressions/map-comprehension.asfl')
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      const comps: string[] = []
      const visit = (node: unknown): void => {
        if (!node || typeof node !== 'object') return
        const n = node as { type?: string; kind?: string }
        if (n.type === 'map_expr' && n.kind === 'comprehension') comps.push('map')
        for (const value of Object.values(node as object)) {
          if (Array.isArray(value)) value.forEach(visit)
          else if (value && typeof value === 'object') visit(value)
        }
      }
      visit(ast)
      expect(comps.length).toBeGreaterThanOrEqual(2)
      expect(ast.modules[0].consts.find((c) => c.name === 'doubled')?.value.type).toBe('map_expr')
    }
  })

  it('nested-union-product-extreme parses parenthesized union product', () => {
    const { ast } = parse(loadGrammarFixture('types/nested-union-product-extreme.asfl'))
    if (isProgramNode(ast)) {
      const pair = ast.modules[0].types.find((t) => t.name === 'PairMix')
      expect(pair?.typeExpr.type).toBe('product_type')
      if (pair?.typeExpr.type === 'product_type') {
        expect(pair.typeExpr.elements[0].type).toBe('union_type')
        expect(pair.typeExpr.elements[1].type).toBe('union_type')
      }
    }
  })
})

const recoveryNegativeFixtures = [
  'negative/unclosed-module.asfl',
  'negative/unclosed-process.asfl',
  'negative/missing-fsf-colon.asfl',
  'negative/bad-type-paren.asfl',
  'negative/bad-comprehension.asfl',
  'negative/invalid-ext.asfl'
]

describe('Grammar fixtures - parse recovery contract', () => {
  for (const rel of recoveryNegativeFixtures) {
    it(`tolerant parse returns partial AST for ${rel}`, () => {
      const source = loadGrammarFixture(rel)
      const { ast, diagnostics } = parse(source)
      expect(ast).not.toBeNull()
      expect(isProgramNode(ast)).toBe(true)
      expect(diagnostics.some((d) => d.code === 'ASFL_PARSE_001')).toBe(true)
    })

    it(`parseStrict returns null AST for ${rel}`, () => {
      const { ast, diagnostics } = parseStrict(loadGrammarFixture(rel))
      expect(ast).toBeNull()
      expect(diagnostics.some((d) => d.code === 'ASFL_PARSE_001')).toBe(true)
    })

    it(`parse({ tolerant: false }) matches parseStrict for ${rel}`, () => {
      const source = loadGrammarFixture(rel)
      const strict = parseStrict(source)
      const explicit = parse(source, { tolerant: false })
      expect(explicit.ast).toBeNull()
      expect(explicit.diagnostics.some((d) => d.code === 'ASFL_PARSE_001')).toBe(true)
      expect(strict.diagnostics.map((d) => d.message)).toEqual(
        explicit.diagnostics.map((d) => d.message)
      )
    })
  }
})

describe('Grammar fixtures - negative', () => {
  for (const rel of listFixtures('negative')) {
    it(`reports error for ${rel}`, () => {
      const { diagnostics } = check(loadGrammarFixture(rel))
      expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
    })
  }

  it('parseStrict returns null AST on unclosed module', () => {
    const { ast, diagnostics } = parseStrict(loadGrammarFixture('negative/unclosed-module.asfl'))
    expect(ast).toBeNull()
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(true)
  })

  it('parseStrict returns null AST on bad type paren', () => {
    const { ast } = parseStrict(loadGrammarFixture('negative/bad-type-paren.asfl'))
    expect(ast).toBeNull()
  })
})
