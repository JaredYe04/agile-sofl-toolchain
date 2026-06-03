import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '../../src/index'
import { textOf } from '../../src/ast/nodes'
import type { Span } from '../../src/ast/span'
import { isProgramNode } from '../../src/ast/guards'

const grammarRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'grammar')
const bankingFixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'integration', 'banking.asfl')

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

  it('banking fixture: param nameSpans cover each identifier', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const proc = ast.modules[0].processes[0]
    const inputGroup = proc.inputs[0]
    expect(inputGroup.nameSpans).toHaveLength(2)
    expectSpanCovers(source, inputGroup.nameSpans![0].span, 'x')
    expectSpanCovers(source, inputGroup.nameSpans![1].span, 'y')
    const outputGroups = proc.outputs
    expect(outputGroups.length).toBeGreaterThanOrEqual(3)
    const outputNames = outputGroups.flatMap((g) => g.nameSpans ?? [])
    expect(outputNames.length).toBeGreaterThanOrEqual(3)
    for (const ns of outputNames) {
      expectSpanCovers(source, ns.span, ns.name)
    }
  })

  it('banking fixture: ext var names have identifier spans', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const ext = ast.modules[0].processes[0].body!.ext
    expect(ext).toHaveLength(2)
    expectSpanCovers(source, ext[0].span, 'a')
    expectSpanCovers(source, ext[1].span, 'b')
  })

  it('banking fixture: comment and decomposition have text spans', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const body = ast.modules[0].processes[0].body!
    const decom = body.decomposition
    expect(typeof decom).toBe('object')
    expect(textOf(decom)).toBe('Banking_Decom')
    if (typeof decom === 'object') {
      expectSpanCovers(source, decom.span, 'Banking_Decom')
    }
    const comment = body.comment
    expect(typeof comment).toBe('object')
    expect(textOf(comment)).toContain('informal')
    if (typeof comment === 'object') {
      expectSpanCovers(source, comment.span, 'informal')
    }
  })

  it('informal FSF text has span covering the informal phrase', () => {
    const source = `module SYSTEM_P;
process P ()
FSF :
informal requirement && y = 1
end_process
end_module`
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const atom = ast.modules[0].processes[0].body!.fsf!.scenarios[0].test.disjuncts[0].atoms[0]
    expect(atom.type).toBe('informal_text')
    expectSpanCovers(source, atom.span, 'informal')
    expectSpanCovers(source, atom.span, 'requirement')
  })

  it('multi-scenario FSF scenarios have non-empty spans', () => {
    const source = readFileSync(bankingFixture, 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const fsf = ast.modules[0].processes[0].body!.fsf!
    expect(fsf.scenarios).toHaveLength(2)
    for (const scenario of fsf.scenarios) {
      expect(scenario.span.end).toBeGreaterThan(scenario.span.start)
      expect(scenario.test.span.end).toBeGreaterThan(scenario.test.span.start)
      expect(scenario.def.span.end).toBeGreaterThan(scenario.def.span.start)
    }
    expect(fsf.others!.span.end).toBeGreaterThan(fsf.others!.span.start)
  })

  it('function declaration span covers name and return type', () => {
    const source = 'module SYSTEM_S;\nfunction add (x: nat): int\n== x + 1\nend_function\nend_module'
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      const fn = ast.modules[0].functions[0]
      expectSpanCovers(source, fn.span, 'add')
      expectSpanCovers(source, fn.returnType.span, 'int')
    }
  })

  it('const initializer expression has non-empty span', () => {
    const source = 'module SYSTEM_S;\nconst limit = 42;\nend_module'
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      expectSpanCovers(source, ast.modules[0].consts[0].value.span, '42')
    }
  })

  it('union type variant spans cover basic names', () => {
    const source = 'module SYSTEM_S;\ntype U = nat | int;\nend_module'
    const { ast } = parse(source)
    if (isProgramNode(ast)) {
      const u = ast.modules[0].types[0].typeExpr
      if (u.type === 'union_type') {
        expectSpanCovers(source, u.variants[0].span, 'nat')
        expectSpanCovers(source, u.variants[1].span, 'int')
      }
    }
  })

  it('set comprehension binding and body spans are non-empty', () => {
    const source = readFileSync(join(grammarRoot, 'expressions', 'comprehension.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const fsf = ast.modules[0].processes[0].body!.fsf!
    const atom = fsf.others!.disjuncts[0].atoms[0]
    if (atom.type === 'relational_expr' && atom.right.type === 'set_expr' && atom.right.kind === 'comprehension') {
      const comp = atom.right
      expect(comp.compBindings?.[0].span.end).toBeGreaterThan(comp.compBindings![0].span.start)
      expect(comp.compExpr?.span.end).toBeGreaterThan(comp.compExpr!.span.start)
    }
  })

  it('fsf-before-body function FSF and body spans cover keywords', () => {
    const source = readFileSync(join(grammarRoot, 'functions', 'fsf-before-body.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const fn = ast.modules[0].functions[0]
    expect(fn.fsf?.span.end).toBeGreaterThan(fn.fsf!.span.start)
    expectSpanCovers(source, fn.body!.span, 'x')
  })

  it('nested-union-product-extreme product elements have spans', () => {
    const source = readFileSync(
      join(grammarRoot, 'types', 'nested-union-product-extreme.asfl'),
      'utf-8'
    )
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const pair = ast.modules[0].types[0].typeExpr
    if (pair.type === 'product_type') {
      for (const el of pair.elements) {
        expect(el.span.end).toBeGreaterThan(el.span.start)
      }
    }
  })

  it('multi-module child parent link spans cover module names', () => {
    const source = readFileSync(join(grammarRoot, 'modules', 'multi-module.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    for (const mod of ast.modules) {
      expectSpanCovers(source, mod.span, mod.name)
    }
    expect(ast.modules[1].parent?.span.end).toBeGreaterThan(ast.modules[1].parent!.span.start)
  })

  it('quantified predicate bindings have identifier spans', () => {
    const source = readFileSync(join(grammarRoot, 'predicates', 'quantifiers.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const inv = ast.modules[0].invariants[0].condition
    const atom = inv.disjuncts[0].atoms[0]
    if (atom.type === 'quantified') {
      expect(atom.bindings[0].names).toContain('i')
      expect(atom.bindings[0].span.end).toBeGreaterThan(atom.bindings[0].span.start)
    }
  })

  it('process ext access spans cover rd and wr keywords', () => {
    const source = readFileSync(join(grammarRoot, 'processes', 'ext-alias.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const ext = ast.modules[0].processes[1].body!.ext!
    expectSpanCovers(source, ext[0].span, 'total')
    expectSpanCovers(source, ext[1].span, 'subtotal')
  })

  it('enum type literal values have spans in type declaration', () => {
    const source = readFileSync(join(grammarRoot, 'types', 'all-types.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const en = ast.modules[0].types.find((t) => t.typeExpr.type === 'enum_type')
    if (en?.typeExpr.type === 'enum_type') {
      expect(en.typeExpr.values.length).toBeGreaterThan(0)
      expect(en.typeExpr.span.end).toBeGreaterThan(en.typeExpr.span.start)
    }
  })

  it('case expression alternative spans cover branch expressions', () => {
    const source = readFileSync(join(grammarRoot, 'expressions', 'case-minimal.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const c = ast.modules[0].functions[0].body
    if (c?.type === 'case_expr') {
      for (const alt of c.alternatives) {
        expect(alt.expr.span.end).toBeGreaterThan(alt.expr.span.start)
      }
    }
  })

  it('let expression binding and body spans are non-empty', () => {
    const source = readFileSync(join(grammarRoot, 'expressions', 'let-if.asfl'), 'utf-8')
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    const letExpr = ast.modules[0].consts[0].value
    if (letExpr.type === 'let_expr') {
      expect(letExpr.bindings[0].span.end).toBeGreaterThan(letExpr.bindings[0].span.start)
      expect(letExpr.body.span.end).toBeGreaterThan(letExpr.body.span.start)
    }
  })

  it('grammar vars in expressions dir have non-empty name spans', () => {
    const source = readFileSync(
      join(grammarRoot, 'expressions', 'keyword-identifiers.asfl'),
      'utf-8'
    )
    const { ast } = parse(source)
    if (!isProgramNode(ast)) return
    for (const v of ast.modules[0].vars) {
      expectSpanCovers(source, v.variable.span, v.variable.name)
    }
  })
})
