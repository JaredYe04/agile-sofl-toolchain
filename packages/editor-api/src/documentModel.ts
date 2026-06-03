import {
  check,
  collectHybridRegions,
  resolveScope,
  type ProgramNode,
  type ProcessNode,
  type HybridRegion
} from '@agile-sofl/parser'
import { toSerializableSpan, type SerializableSpan } from './span.js'

export interface DiagnosticSummary {
  code: string
  message: string
  severity: string
  span: SerializableSpan
}

export interface ModuleSummary {
  id: string
  name: string
  isSystem: boolean
  parentName?: string
  span: SerializableSpan
}

export interface DocumentModel {
  modules: ModuleSummary[]
  diagnostics: DiagnosticSummary[]
  errorCount: number
  warningCount: number
}

export function buildDocumentModel(source: string): DocumentModel
export function buildDocumentModel(ast: ProgramNode, source?: string): DocumentModel
export function buildDocumentModel(sourceOrAst: string | ProgramNode, sourceArg?: string): DocumentModel {
  if (typeof sourceOrAst === 'string') {
    const { ast, diagnostics } = check(sourceOrAst)
    return buildDocumentModelFromAst(ast, diagnostics, sourceOrAst)
  }
  const source = sourceArg ?? ''
  const { diagnostics } = source ? check(source) : { diagnostics: [] }
  return buildDocumentModelFromAst(sourceOrAst, diagnostics, source)
}

function buildDocumentModelFromAst(
  ast: ProgramNode | null,
  diagnostics: Array<{ code: string; message: string; severity: string; span: SpanLike }>,
  _source: string
): DocumentModel {
  const modules: ModuleSummary[] =
    ast?.modules.map((mod) => ({
      id: mod.name,
      name: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
      isSystem: mod.isSystem,
      parentName: mod.parent?.name,
      span: toSerializableSpan(mod.span)
    })) ?? []

  const mapped = diagnostics.map((d) => ({
    code: d.code,
    message: d.message,
    severity: d.severity,
    span: toSerializableSpan(d.span)
  }))

  return {
    modules,
    diagnostics: mapped,
    errorCount: mapped.filter((d) => d.severity === 'error').length,
    warningCount: mapped.filter((d) => d.severity === 'warning').length
  }
}

interface SpanLike {
  start: number
  end: number
  line: number
  column: number
}

export function buildHybridRegions(ast: ProgramNode): HybridRegion[] {
  return collectHybridRegions(ast)
}

export { collectHybridRegions }
export type { HybridRegion }

export function findProcess(ast: ProgramNode, processName: string): ProcessNode | undefined {
  for (const mod of ast.modules) {
    const proc = mod.processes.find((p) => p.name === processName)
    if (proc) return proc
  }
  return undefined
}

export function buildSymbolIndex(ast: ProgramNode, _source: string) {
  const scope = resolveScope(ast)
  return scope.symbols.map((sym) => ({
    kind: sym.kind,
    name: sym.name,
    moduleName: sym.moduleName,
    span: toSerializableSpan(sym.span),
    qualifiedName: `${sym.moduleName}.${sym.name}`
  }))
}
