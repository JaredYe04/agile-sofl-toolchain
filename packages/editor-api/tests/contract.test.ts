import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildDocumentModel,
  buildHybridRegions,
  buildFsfModelByName,
  buildAllFsfModels,
  buildModuleGraph,
  buildSymbolIndex,
  patchFsfSpec,
  patchComment,
  patchInformal,
  formatDocument,
  ProjectIndex,
  checkIncremental,
  toSerializableSpan
} from '../src/index.js'
import { parse } from '@agile-sofl/parser'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const banking = readFileSync(join(repoRoot, 'tests', 'fixtures', 'integration', 'banking.asfl'), 'utf8')

const DEMO = `module SYSTEM_Demo;
process Demo (x: nat) ok: nat
FSF :
x > 0 && ok = 1 ||
others && ok = 0
decom: DemoDecom
comment: informal note
end_process
end_module`

describe('editor-api contract', () => {
  it('buildDocumentModel returns modules array', () => {
    const model = buildDocumentModel(banking)
    expect(model.modules.length).toBeGreaterThan(0)
    expect(model.modules[0]).toMatchObject({ name: expect.any(String), span: expect.any(Object) })
  })

  it('buildDocumentModel counts diagnostics', () => {
    const model = buildDocumentModel('module broken')
    expect(model.errorCount).toBeGreaterThan(0)
  })

  it('buildDocumentModel accepts AST input', () => {
    const { ast } = parse(banking)
    expect(ast?.type).toBe('program')
    if (ast?.type === 'program') {
      const model = buildDocumentModel(ast, banking)
      expect(model.modules.length).toBe(ast.modules.length)
    }
  })

  it('toSerializableSpan copies span fields', () => {
    const span = toSerializableSpan({ start: 1, end: 5, line: 2, column: 3 })
    expect(span).toEqual({ start: 1, end: 5, line: 2, column: 3 })
  })

  it('buildHybridRegions finds fsf region', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const regions = buildHybridRegions(ast)
      expect(regions.some((r) => r.type === 'fsf')).toBe(true)
    }
  })

  it('buildHybridRegions finds comment region', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const regions = buildHybridRegions(ast)
      expect(regions.some((r) => r.type === 'comment')).toBe(true)
    }
  })

  it('buildFsfModelByName extracts scenarios', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const model = buildFsfModelByName(ast, DEMO, 'Demo')
      expect(model?.scenarios.length).toBe(1)
      expect(model?.scenarios[0].test).toContain('x > 0')
    }
  })

  it('buildAllFsfModels lists all processes with FSF', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      expect(buildAllFsfModels(ast, DEMO)).toHaveLength(1)
    }
  })

  it('buildModuleGraph includes module and process nodes', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const graph = buildModuleGraph(ast)
      expect(graph.nodes.some((n) => n.kind === 'module')).toBe(true)
      expect(graph.nodes.some((n) => n.kind === 'process')).toBe(true)
    }
  })

  it('buildModuleGraph includes decom edge', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const graph = buildModuleGraph(ast)
      expect(graph.edges.some((e) => e.kind === 'decom')).toBe(true)
    }
  })

  it('buildSymbolIndex returns flat symbols', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const syms = buildSymbolIndex(ast, DEMO)
      expect(syms.some((s) => s.kind === 'process')).toBe(true)
    }
  })

  it('patchFsfSpec replaces FSF block', () => {
    const next = patchFsfSpec(DEMO, 'Demo', [
      { id: '1', test: 'true', def: 'ok = 0', span: { start: 0, end: 0, line: 1, column: 1 } }
    ], 'ok = 1')
    expect(next).toContain('others && ok = 1')
    expect(next).toContain('true && ok = 0')
  })

  it('patchFsfSpec roundtrip preserves parse', () => {
    const next = patchFsfSpec(DEMO, 'Demo', [
      { id: '1', test: 'x > 0', def: 'ok = 2', span: { start: 0, end: 0, line: 1, column: 1 } }
    ])
    const { ast, diagnostics } = parse(next)
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error' && d.code === 'ASFL_PARSE_001')).toHaveLength(0)
  })

  it('patchComment updates comment line', () => {
    const next = patchComment(DEMO, 'Demo', 'updated note')
    expect(next).toContain('comment: updated note')
  })

  it('patchInformal replaces span text', () => {
    const idx = DEMO.indexOf('informal note')
    const next = patchInformal(DEMO, { start: idx, end: idx + 'informal note'.length }, 'formal note')
    expect(next).toContain('formal note')
  })

  it('formatDocument normalizes spacing via printer', () => {
    const messy = 'module SYSTEM_X;\nvar x:nat;\nend_module'
    const formatted = formatDocument(messy)
    expect(formatted).toMatch(/var\s+x:\s+nat/)
  })

  it('ProjectIndex is re-exported and usable', () => {
    const index = new ProjectIndex()
    index.upsert('file:///t.asfl', DEMO)
    expect(index.symbols('Demo').length).toBeGreaterThan(0)
  })

  it('checkIncremental caches unchanged source', () => {
    const first = checkIncremental(DEMO)
    const second = checkIncremental(DEMO, first.state)
    expect(second.state).toBe(first.state)
  })

  it('FsfScenarioDto shape is JSON-serializable', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const model = buildFsfModelByName(ast, DEMO, 'Demo')
      const json = JSON.stringify(model)
      const parsed = JSON.parse(json) as { scenarios: Array<{ test: string }> }
      expect(parsed.scenarios[0].test).toBeTypeOf('string')
    }
  })

  it('ModuleGraph is JSON-serializable', () => {
    const { ast } = parse(DEMO)
    if (ast?.type === 'program') {
      const json = JSON.stringify(buildModuleGraph(ast))
      expect(JSON.parse(json).nodes.length).toBeGreaterThan(0)
    }
  })

  it('DocumentModel diagnostics include code field', () => {
    const model = buildDocumentModel('module SYSTEM_E;\nprocess P()\nend_module')
    if (model.diagnostics.length) {
      expect(model.diagnostics[0].code).toBeTruthy()
    }
  })

  it('buildModuleGraph parent edge links child module', () => {
    const source = `module SYSTEM_R;\nend_module;\nmodule Child / R;\nend_module`
    const { ast } = parse(source)
    if (ast?.type === 'program') {
      const graph = buildModuleGraph(ast)
      expect(graph.edges.some((e) => e.from === 'Child' && e.to === 'R')).toBe(true)
    }
  })
})
