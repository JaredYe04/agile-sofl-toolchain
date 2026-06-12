/**
 * Agile-SOFL parser library.
 * Parse hybrid specifications to AST with scope, type checking, and FSF classification.
 */

import { parse, parseModule, parseStrict } from './parser/parse.js'
import { typeCheck } from './typecheck/checker.js'
import { classifyFsf, isFsfFormal } from './fsf/classifier.js'
import { resolveScope, lookupModuleScope } from './scope/resolver.js'
import { checkReferences } from './scope/referenceChecker.js'
import { normalizeAST, astEqual, stripSpans } from './transform/normalize.js'
import { printProgram, printPredicate, printType, printExpr } from './transform/print.js'
import { walk, getNodeAtOffset, findNodeAtOffset, collectHybridRegions } from './visitor/walk.js'
import type { ProgramNode } from './ast/nodes.js'
import type { Diagnostic } from './diagnostics/codes.js'
import { formatDiagnostic } from './diagnostics/codes.js'

export { textOf } from './ast/nodes.js'
export type {
  ProgramNode,
  ModuleNode,
  ProcessNode,
  FunctionNode,
  ParamGroupNode,
  PredicateNode,
  AtomicPredicateNode,
  QuantifiedNode,
  InformalTextNode,
  TextWithSpan,
  MaybeTextWithSpan,
  TypeExprNode,
  AST
} from './ast/nodes.js'
export type { Diagnostic, DiagnosticSeverity } from './diagnostics/codes.js'
export type { Span } from './ast/span.js'
export type { Visitor, HybridRegion, HybridRegionType } from './visitor/walk.js'
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

/** Parse full specification (multiple modules). Uses strict parse — no partial AST on errors. */
export function parseSpecification(source: string): CheckResult {
  const result = parseStrict(source)
  if (!result.ast || result.ast.type !== 'program') {
    return { ast: null, diagnostics: result.diagnostics }
  }
  if (result.diagnostics.some((d) => d.severity === 'error')) {
    return { ast: null, diagnostics: result.diagnostics }
  }
  const scopeResult = resolveScope(result.ast)
  const refResult = checkReferences(result.ast, scopeResult)
  const typeResult = typeCheck(result.ast, scopeResult)
  const fsfResult = classifyFsf(result.ast)
  return {
    ast: result.ast,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...refResult.diagnostics,
      ...typeResult.diagnostics,
      ...fsfResult.diagnostics
    ]
  }
}

/** Parse single module (Module Parser mode). Uses strict parse. */
export function parseSingleModule(source: string): CheckResult {
  const result = parseModule(source, { tolerant: false })
  if (!result.ast || result.ast.type !== 'module') {
    return { ast: null, diagnostics: result.diagnostics }
  }
  const program: ProgramNode = {
    type: 'program',
    span: result.ast.span,
    modules: [result.ast]
  }
  const scopeResult = resolveScope(program)
  const refResult = checkReferences(program, scopeResult)
  const typeResult = typeCheck(program, scopeResult)
  const fsfResult = classifyFsf(program)
  return {
    ast: program,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...refResult.diagnostics,
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
  parseStrict,
  parseModule,
  typeCheck,
  classifyFsf,
  isFsfFormal,
  resolveScope,
  lookupModuleScope,
  normalizeAST,
  astEqual,
  stripSpans,
  printProgram,
  printPredicate,
  printType,
  printExpr,
  walk,
  getNodeAtOffset,
  findNodeAtOffset,
  collectHybridRegions,
  formatDiagnostic
}

export { resolveReference, resolveDeclarationAtOffset, resolveReferenceByName } from './scope/reference.js'
export { checkReferences } from './scope/referenceChecker.js'
export type { ReferenceTarget } from './scope/reference.js'
export type { AstNode } from './visitor/walk.js'

export { ProjectIndex, createProjectIndex } from './project/projectIndex.js'
export type { ProjectDocument, ProjectSymbol, DefinitionLocation } from './project/projectIndex.js'

export {
  checkIncremental,
  createIncrementalState,
  getChangedModules,
  moduleSourceHashes
} from './parser/incremental.js'
export type { IncrementalCheckState } from './parser/incremental.js'

export { inspect, formatInspectReport } from './cli/report.js'
export type { InspectReport, InspectOptions } from './cli/report.js'
export {
  formatSymbolSummary,
  formatInformalSummary,
  formatTextFieldSummary,
  textFieldSpan
} from './inspect/symbolSummary.js'
export type { SymbolSummaryInput } from './inspect/symbolSummary.js'
export { typeToString, typeExprToInternal, resolveInternalType, typesCompatible, typesCompatibleStrict } from './typecheck/types.js'
