/**
 * Agile-SOFL parser library.
 * Parse hybrid specifications to AST with scope, type checking, and FSF classification.
 */

import { parse, parseModule } from './parser/parse.js'
import { typeCheck } from './typecheck/checker.js'
import { classifyFsf } from './fsf/classifier.js'
import { resolveScope } from './scope/resolver.js'
import { normalizeAST, astEqual, stripSpans } from './transform/normalize.js'
import { printProgram } from './transform/print.js'
import { walk, getNodeAtOffset, findNodeAtOffset } from './visitor/walk.js'
import type { ProgramNode } from './ast/nodes.js'
import type { Diagnostic } from './diagnostics/codes.js'
import { formatDiagnostic } from './diagnostics/codes.js'

export type { ProgramNode, ModuleNode, ProcessNode, PredicateNode, AtomicPredicateNode, InformalTextNode, AST } from './ast/nodes.js'
export type { Diagnostic, DiagnosticSeverity } from './diagnostics/codes.js'
export type { Span } from './ast/span.js'
export type { Visitor } from './visitor/walk.js'
export type { ParseResult } from './parser/parse.js'
export type { ScopeResult, SymbolEntry, ModuleScope } from './scope/resolver.js'

export interface CheckResult {
  ast: ProgramNode | null
  diagnostics: Diagnostic[]
}

export interface FormatResult {
  source: string
  diagnostics: Diagnostic[]
}

/** Parse full specification (multiple modules). */
export function parseSpecification(source: string): CheckResult {
  const result = parse(source)
  if (!result.ast || result.ast.type !== 'program') {
    return { ast: null, diagnostics: result.diagnostics }
  }
  if (result.diagnostics.some((d) => d.severity === 'error')) {
    return { ast: result.ast, diagnostics: result.diagnostics }
  }
  const scopeResult = resolveScope(result.ast)
  const typeResult = typeCheck(result.ast)
  const fsfResult = classifyFsf(result.ast)
  return {
    ast: result.ast,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...typeResult.diagnostics,
      ...fsfResult.diagnostics
    ]
  }
}

/** Parse single module (Module Parser mode). */
export function parseSingleModule(source: string): CheckResult {
  const result = parseModule(source)
  if (!result.ast || result.ast.type !== 'module') {
    return { ast: null, diagnostics: result.diagnostics }
  }
  const program: ProgramNode = {
    type: 'program',
    span: result.ast.span,
    modules: [result.ast]
  }
  const scopeResult = resolveScope(program)
  const typeResult = typeCheck(program)
  const fsfResult = classifyFsf(program)
  return {
    ast: program,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...typeResult.diagnostics,
      ...fsfResult.diagnostics
    ]
  }
}

/** Full check pipeline (alias). */
export function check(source: string): CheckResult {
  return parseSpecification(source)
}

/** Pretty-print specification. */
export function format(source: string): FormatResult {
  const { ast, diagnostics } = parseSpecification(source)
  if (!ast) return { source, diagnostics }
  return { source: printProgram(ast), diagnostics }
}

export {
  parse,
  parseModule,
  typeCheck,
  classifyFsf,
  resolveScope,
  normalizeAST,
  astEqual,
  stripSpans,
  printProgram,
  walk,
  getNodeAtOffset,
  findNodeAtOffset,
  formatDiagnostic
}

export { resolveReference, resolveDeclarationAtOffset } from './scope/reference.js'
export type { ReferenceTarget } from './scope/reference.js'
export type { AstNode } from './visitor/walk.js'

export { inspect, formatInspectReport } from './cli/report.js'
export type { InspectReport, InspectOptions } from './cli/report.js'
