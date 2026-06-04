import { parse, textOf, type ProgramNode } from '@agile-sofl/parser'
import { buildModuleGraph } from './moduleGraph.js'
import { buildAllFsfModels } from './fsfModel.js'
import { sliceText, toSerializableSpan } from './span.js'

export type VisualParseDiagnostic = {
  code: string
  message: string
  severity: string
  span: ReturnType<typeof toSerializableSpan>
}

export type VisualModelResult = {
  parseFailed: boolean
  hasDiagnostics: boolean
  ast: ProgramNode | null
  diagnostics: VisualParseDiagnostic[]
  moduleGraph: ReturnType<typeof buildModuleGraph> | null
  fsfModels: ReturnType<typeof buildAllFsfModels>
  modules: Array<{
    name: string
    isSystem: boolean
    parentName?: string
    constCount: number
    typeCount: number
    varCount: number
    invCount: number
    invariants: Array<{ text: string; span: ReturnType<typeof toSerializableSpan> }>
    processes: Array<{
      name: string
      span: ReturnType<typeof toSerializableSpan>
      decom: string
      comment: string
      hasFsf: boolean
    }>
    functions: Array<{
      name: string
      text: string
      span: ReturnType<typeof toSerializableSpan>
    }>
    consts: Array<{ name: string; text: string; span: ReturnType<typeof toSerializableSpan> }>
    types: Array<{ name: string; text: string; span: ReturnType<typeof toSerializableSpan> }>
    vars: Array<{ name: string; text: string; span: ReturnType<typeof toSerializableSpan> }>
  }>
}

function mapDiagnostics(
  items: Array<{ code: string; message: string; severity: string; span: { start: number; end: number; line: number; column: number } }>
): VisualParseDiagnostic[] {
  return items.map((d) => ({
    code: d.code,
    message: d.message,
    severity: d.severity,
    span: toSerializableSpan(d.span)
  }))
}

/** Tolerant parse for visual editor — keeps partial AST when possible. */
export function buildVisualModelTolerant(source: string): VisualModelResult {
  const { ast, diagnostics: parseDiags } = parse(source)
  const program = ast?.type === 'program' ? ast : null
  const parseFailed = !program

  const allDiagnostics = mapDiagnostics(
    parseDiags.map((d) => ({
      code: d.code,
      message: d.message,
      severity: d.severity,
      span: d.span
    }))
  )

  const hasDiagnostics = allDiagnostics.some((d) => d.severity === 'error')

  if (!program) {
    return {
      parseFailed,
      hasDiagnostics,
      ast: null,
      diagnostics: allDiagnostics,
      moduleGraph: null,
      fsfModels: [],
      modules: []
    }
  }

  return {
    parseFailed,
    hasDiagnostics,
    ast: program,
    diagnostics: allDiagnostics,
    moduleGraph: buildModuleGraph(program),
    fsfModels: buildAllFsfModels(program, source),
    modules: program.modules.map((mod) => ({
      name: mod.name,
      isSystem: mod.isSystem,
      parentName: mod.parent?.name,
      constCount: mod.consts.length,
      typeCount: mod.types.length,
      varCount: mod.vars.length,
      invCount: mod.invariants.length,
      invariants: mod.invariants.map((inv) => ({
        text: sliceText(source, inv.span).trim(),
        span: toSerializableSpan(inv.span)
      })),
      processes: mod.processes.map((p) => ({
        name: p.name,
        span: toSerializableSpan(p.span),
        decom: textOf(p.body?.decomposition) ?? '',
        comment: textOf(p.body?.comment) ?? '',
        hasFsf: Boolean(p.body?.fsf)
      })),
      functions: mod.functions.map((f) => ({
        name: f.name,
        text: sliceText(source, f.span).trim(),
        span: toSerializableSpan(f.span)
      })),
      consts: mod.consts.map((c) => ({
        name: c.name,
        text: sliceText(source, c.span).trim(),
        span: toSerializableSpan(c.span)
      })),
      types: mod.types.map((t) => ({
        name: t.name,
        text: sliceText(source, t.span).trim(),
        span: toSerializableSpan(t.span)
      })),
      vars: mod.vars.map((v) => ({
        name: v.variable.name,
        text: sliceText(source, v.span).trim(),
        span: toSerializableSpan(v.span)
      }))
    }))
  }
}
