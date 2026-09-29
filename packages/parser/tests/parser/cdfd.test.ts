import { describe, it, expect } from 'vitest'
import { parse, check, printProgram, analyzeProcessAtomicity, checkCdfd, checkDataRefine } from '../../src/index'
import { isProgramNode } from '../../src/ast/guards'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'grammar', 'modules', 'cdfd-banking-decom.asfl'),
  'utf-8'
)

describe('CDFD grammar', () => {
  it('parses cdfd ports, stores, conditions, flows and refine', () => {
    const { ast, diagnostics } = parse(fixture)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    expect(errors).toEqual([])
    expect(isProgramNode(ast)).toBe(true)
    if (!isProgramNode(ast)) return
    const child = ast.modules.find((m) => m.name === 'Banking_Decom')
    expect(child?.cdfd?.nodes.map((n) => n.name)).toEqual(['Withdraw', 'Reject'])
    expect(child?.cdfd?.conditions[0]?.name).toBe('Gate')
    expect(child?.cdfd?.flows.some((f) => f.isOthers)).toBe(true)
    expect(child?.refine?.items[0]?.retrieveFunction).toBe('account_of')
  })

  it('pretty-prints cdfd and refine', () => {
    const { ast } = parse(fixture)
    if (!isProgramNode(ast)) return
    const printed = printProgram(ast)
    expect(printed).toContain('cdfd')
    expect(printed).toContain('flow Gate | others -> Reject')
    expect(printed).toContain('retrieve account_of')
    const again = parse(printed)
    expect(again.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
  })

  it('resolves decom to a module and balances ports', () => {
    const { ast } = parse(fixture)
    if (!isProgramNode(ast)) return
    const { diagnostics } = checkCdfd(ast)
    const errors = diagnostics.filter((d) => d.severity === 'error')
    expect(errors).toEqual([])
  })

  it('counts process and data ambiguity separately', () => {
    const { ast } = parse(fixture)
    if (!isProgramNode(ast)) return
    const proc = analyzeProcessAtomicity(ast)
    const data = checkDataRefine(ast)
    expect(proc.processAmbiguity).toBeGreaterThan(0)
    expect(data.dataAmbiguity).toBeGreaterThan(0)
    expect(data.diagnostics.some((d) => d.code === 'ASFL_DATA_005')).toBe(true)
    expect(data.items.some((i) => i.kind === 'obligation' && i.typeName === 'Account')).toBe(true)
    const parent = proc.processes.find((p) => p.processName === 'A')
    expect(parent?.decomTarget).toBe('Banking_Decom')
  })

  it('keeps old files without cdfd parseable', () => {
    const source = `module SYSTEM_P;
process P ()
pre true
post true
end_process
end_module`
    const { ast, diagnostics } = parse(source)
    expect(ast).not.toBeNull()
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const checked = check(source)
    expect(checked.diagnostics.some((d) => d.code === 'ASFL_CDFD_001')).toBe(false)
    expect(checked.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const strict = check(source, { refinementStrict: true })
    expect(strict.diagnostics.some((d) => d.code === 'ASFL_CDFD_001' && d.severity === 'error')).toBe(true)
  })

  it('accepts the type keyword time as a parameter and expression name', () => {
    const source = `module SYSTEM_Course;
var
courses: set of Course;
process 维护课程 (course_id: nat, name: string, teacher: string, time: string, place: string)
    pre
        not exists c in courses: c.course_id = course_id
    post
        courses = courses~ union {mk_(course_id, name, teacher, time, place)}
end_process
end_module`
    const { ast, diagnostics } = parse(source)
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(ast?.type).toBe('program')
    if (ast?.type !== 'program') return
    const proc = ast.modules[0]?.processes[0]
    expect(proc?.inputs.flatMap((g) => g.names)).toEqual(['course_id', 'name', 'teacher', 'time', 'place'])
  })

  it('rejects a second cdfd block', () => {
    const source = `module SYSTEM_P;
process P ()
pre true
post true
end_process
cdfd
  node P
end_cdfd
cdfd
  node P
end_cdfd
end_module`
    const { ast } = parse(source)
    expect(ast?.type).toBe('program')
    if (ast?.type !== 'program') return
    expect(ast.modules[0]?.cdfd?.extraBlockCount).toBe(1)
    const { diagnostics } = checkCdfd(ast)
    expect(diagnostics.some((d) => d.code === 'ASFL_CDFD_006')).toBe(true)
  })

  it('counts name-only modules and stub processes as incomplete', () => {
    const emptySource = `module SYSTEM_Empty;
end_module
module ScoreEntry / Empty;
end_module`
    const emptyAst = parse(emptySource).ast
    expect(emptyAst?.type).toBe('program')
    if (emptyAst?.type !== 'program') return
    const emptyReport = analyzeProcessAtomicity(emptyAst)
    expect(emptyReport.emptyModuleCount).toBe(1)
    expect(emptyReport.processAmbiguity).toBeGreaterThanOrEqual(1)

    const stubSource = `module SYSTEM_S;
process P ()
end_process
end_module`
    const stubAst = parse(stubSource).ast
    expect(stubAst?.type).toBe('program')
    if (stubAst?.type !== 'program') return
    const stubReport = analyzeProcessAtomicity(stubAst)
    expect(stubReport.stubProcessCount).toBe(1)
    expect(stubReport.processes[0]?.isStub).toBe(true)
    expect(stubReport.processes[0]?.structurallyAtomic).toBe(false)
    expect(stubReport.emptyModuleCount).toBe(0)
  })
})
