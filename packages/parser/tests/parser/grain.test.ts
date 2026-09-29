import { describe, expect, it } from 'vitest'
import { parse } from '../../src/index.js'
import {
  analyzeProcessGrain,
  authorNotesFromInformalMarkdown,
  extractAuthorVariations,
  observeEffectPattern
} from '../../src/refine/grain.js'

const maintain = `module SYSTEM_S;
type Student = composed of
  student_id: nat
  name: string
end;
var students: set of Student;
process 维护学生 (student_id: nat, name: string)
ext wr students: set of Student
pre true
post students = union(students, {mk_Student(student_id, name)})
comment: 包括登记、修改、退学
end_process
end_module`

describe('operational grain', () => {
  it('extracts list items the author already wrote and ignores plain prose', () => {
    expect(extractAuthorVariations('包括登记、修改、退学')).toEqual(['登记', '修改', '退学'])
    expect(extractAuthorVariations('withdraw and transfer')).toEqual(['withdraw', 'transfer'])
    expect(extractAuthorVariations('A member borrows a book when both ids are valid.')).toEqual([])
  })

  it('reads informal heading bodies without turning them into operations', () => {
    const notes = authorNotesFromInformalMarkdown(`# Functions\n\n## 维护学生\n\n包括登记、修改\n`)
    expect(notes).toEqual([{ processName: '维护学生', text: '包括登记、修改' }])
  })

  it('sees a single union as insert and a concern name as a mismatch', () => {
    const { ast } = parse(maintain)
    expect(ast?.type).toBe('program')
    if (ast?.type !== 'program') return
    const proc = ast.modules[0]!.processes[0]!
    expect(observeEffectPattern(proc)).toBe('insert')
    const row = analyzeProcessGrain(ast).processes[0]!
    expect(row.effectPattern).toBe('insert')
    expect(row.nameEffectMismatch).toBe(true)
    expect(row.variations.map((item) => item.text)).toEqual(['登记', '修改', '退学'])
    expect(row.variations.every((item) => item.disposition === 'unresolved')).toBe(true)
  })

  it('does not invent a catalog for a single-effect name without a concern marker', () => {
    const source = `module SYSTEM_S;
process 转班 (id: nat) ok: nat
pre true
post ok = id
end_process
end_module`
    const { ast } = parse(source)
    if (ast?.type !== 'program') return
    const row = analyzeProcessGrain(ast).processes[0]!
    expect(row.nameEffectMismatch).toBe(false)
    expect(row.variations).toEqual([])
    expect(row.effectPattern === 'opaque' || row.effectPattern === 'query').toBe(true)
  })

  it('marks two different effects in one post as mixed', () => {
    const source = `module SYSTEM_S;
process Edit (id: nat)
pre true
post students = union(students, {id}) and gone = diff(students, {id})
end_process
end_module`
    const { ast } = parse(source)
    if (ast?.type !== 'program') return
    expect(analyzeProcessGrain(ast).processes[0]?.effectPattern).toBe('mixed')
  })

  it('attaches informal notes by process name', () => {
    const source = `module SYSTEM_S;
process 维护学生 (id: nat) ok: nat
pre true
post students = union(students, {id})
end_process
end_module`
    const { ast } = parse(source)
    if (ast?.type !== 'program') return
    const row = analyzeProcessGrain(ast, [{ processName: '维护学生', text: '包括登记、退学' }]).processes[0]!
    expect(row.variations.map((item) => item.text)).toEqual(['登记', '退学'])
  })
})
