/**
 * Agile-SOFL parser library.
 * Parse hybrid specifications to AST with scope, type checking, and FSF classification.
 */

import { parse, parseModule, parseStrict } from './parser/parse.js'
import { typeCheck } from './typecheck/checker.js'
import { classifyFsf, isFsfFormal } from './fsf/classifier.js'
import { deriveFsf, deriveAllFsf } from './fsf/deriver.js'
import { checkCdfd } from './cdfd/checkCdfd.js'
import { checkFsfL1 } from './fsf/l1Check.js'
import { checkFsfL2, type L2Options } from './fsf/l2Check.js'
import { checkDataRefine } from './refine/checkDataRefine.js'
import { resolveScope, lookupModuleScope } from './scope/resolver.js'
import { checkReferences } from './scope/referenceChecker.js'
import { normalizeAST, astEqual, stripSpans } from './transform/normalize.js'
import { printProgram, printPredicate, printType, printExpr, printCdfdBlock, printRefineBlock } from './transform/print.js'
import { walk, getNodeAtOffset, findNodeAtOffset, collectHybridRegions } from './visitor/walk.js'
import type { ProgramNode } from './ast/nodes.js'
import type { Diagnostic } from './diagnostics/codes.js'
import { formatDiagnostic } from './diagnostics/codes.js'

export { textOf } from './ast/nodes.js'
export { attachAndValidateGui, removeGuiBlocksForParse, parseGuiBlock } from './gui/guiBlock.js'
export type {
  ProgramNode,
  ModuleNode,
  GuiBlockNode,
  GuiScreenNode,
  GuiWidgetNode,
  CdfdBlockNode,
  CdfdPortNode,
  CdfdStoreNode,
  CdfdProcessRefNode,
  CdfdCondNode,
  CdfdFlowNode,
  RefineBlockNode,
  RefineTypeItemNode,
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
  AST,
  ConditionClauseNode,
  ProcessBodyNode,
  FsfSpecNode
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

export interface CheckOptions {
  refinementStrict?: boolean
  /** Run the L1 FSF static check (T has no outputs, D has an output). Default true. */
  fsfL1?: boolean
}

/** Parse full specification (multiple modules). Uses strict parse — no partial AST on errors. */
export function parseSpecification(source: string, options?: CheckOptions): CheckResult {
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
  const l1Result = options?.fsfL1 === false ? { diagnostics: [] } : checkFsfL1(result.ast)
  const cdfdResult = checkCdfd(result.ast, options)
  const dataResult = checkDataRefine(result.ast)
  return {
    ast: result.ast,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...refResult.diagnostics,
      ...typeResult.diagnostics,
      ...fsfResult.diagnostics,
      ...l1Result.diagnostics,
      ...cdfdResult.diagnostics,
      ...dataResult.diagnostics
    ]
  }
}

/** Parse single module (Module Parser mode). Uses strict parse. */
export function parseSingleModule(source: string, options?: CheckOptions): CheckResult {
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
  const l1Result = options?.fsfL1 === false ? { diagnostics: [] } : checkFsfL1(program)
  return {
    ast: program,
    diagnostics: [
      ...result.diagnostics,
      ...scopeResult.diagnostics,
      ...refResult.diagnostics,
      ...typeResult.diagnostics,
      ...fsfResult.diagnostics,
      ...l1Result.diagnostics
    ]
  }
}

/** Full check pipeline (alias). */
export function check(source: string, options?: CheckOptions): CheckResult {
  return parseSpecification(source, options)
}

export interface AsyncCheckOptions extends CheckOptions {
  /** Run the L2 Z3 FSF check (mutual exclusion / completeness). Default true. */
  fsfL2?: boolean
  l2?: L2Options
}

/** check() plus the asynchronous L2 (Z3) FSF check. L2 runs only when parsing succeeded. */
export async function checkAsync(source: string, options?: AsyncCheckOptions): Promise<CheckResult> {
  const result = parseSpecification(source, options)
  if (!result.ast || options?.fsfL2 === false) return result
  const l2 = await checkFsfL2(result.ast, options?.l2)
  return { ast: result.ast, diagnostics: [...result.diagnostics, ...l2.diagnostics] }
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
  deriveFsf,
  deriveAllFsf,
  resolveScope,
  lookupModuleScope,
  normalizeAST,
  astEqual,
  stripSpans,
  printProgram,
  printPredicate,
  printType,
  printExpr,
  printCdfdBlock,
  printRefineBlock,
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
export { typeExprToInternal, resolveInternalType, typeToString } from './typecheck/types.js'
export { parsePredicateSource } from './prepost/parsePredicate.js'
export { printConditionText, clauseHasInformal } from './prepost/clause.js'
export { checkCdfd } from './cdfd/checkCdfd.js'
export { checkFsfL1, checkProcessFsfL1 } from './fsf/l1Check.js'
export { checkFsfL2, checkProcessFsfL2 } from './fsf/l2Check.js'
export type { L2Options, SolveResult, SolveStatus } from './fsf/l2Check.js'
export type { CheckCdfdOptions } from './cdfd/checkCdfd.js'
export { analyzeProcessAtomicity, collectInformalAtoms, canDeclareAtomic } from './refine/atomicity.js'
export type { InformalAtomRef, ProcessAtomicity, ProcessAmbiguityReport } from './refine/atomicity.js'
export {
  analyzeProcessGrain,
  authorNotesFromInformalMarkdown,
  extractAuthorVariations,
  observeEffectPattern
} from './refine/grain.js'
export type {
  AuthorTextNote,
  EffectPattern,
  GrainVariation,
  ProcessGrain,
  ProcessGrainReport,
  VariationDisposition,
  VariationSource
} from './refine/grain.js'
export { checkDataRefine } from './refine/checkDataRefine.js'
export type { DataRefinementReport, DataRefinementItem, DataRefinementItemKind } from './refine/checkDataRefine.js'
export type { FunctionalScenarioForm, DerivedFunctionalScenario } from './fsf/deriver.js'
