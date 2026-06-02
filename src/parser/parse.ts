/**
 * Main parse pipeline: lex → parse → CST → AST → diagnostics
 */

import { AgileSoflLexer } from '../lexer/tokens.js'
import { parserInstance } from './parser.js'
import { cstToProgram, cstToModuleAst } from './cstToAst.js'
import type { ProgramNode, ModuleNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import { EMPTY_SPAN } from '../ast/span.js'
import type { CstNode } from 'chevrotain'

export interface ParseResult {
  ast: ProgramNode | ModuleNode | null
  diagnostics: Diagnostic[]
}

function lexErrorsToDiagnostics(
  errors: Array<{ message: string; line?: number; column?: number; offset?: number }>
): Diagnostic[] {
  return errors.map((e) =>
    createDiagnostic(
      DiagnosticCodes.LEX_ERROR,
      e.message,
      'error',
      spanFromLexError(e)
    )
  )
}

function spanFromLexError(e: { line?: number; column?: number; offset?: number }) {
  const line = e.line ?? 1
  const column = e.column ?? 1
  const offset = e.offset ?? 0
  return { start: offset, end: offset + 1, line, column }
}

function parseErrorsToDiagnostics(): Diagnostic[] {
  return parserInstance.errors.map((e) =>
    createDiagnostic(
      DiagnosticCodes.PARSE_ERROR,
      e.message,
      'error',
      {
        start: e.token?.startOffset ?? 0,
        end: e.token?.endOffset ?? 0,
        line: e.token?.startLine ?? 1,
        column: e.token?.startColumn ?? 1
      }
    )
  )
}

export function parse(source: string): ParseResult {
  const diagnostics: Diagnostic[] = []
  const lexResult = AgileSoflLexer.tokenize(source)
  if (lexResult.errors.length > 0) {
    diagnostics.push(...lexErrorsToDiagnostics(lexResult.errors))
    return { ast: null, diagnostics }
  }
  parserInstance.input = lexResult.tokens
  const cst = parserInstance.specification() as CstNode
  if (parserInstance.errors.length > 0) {
    diagnostics.push(...parseErrorsToDiagnostics())
  }
  if (!cst) return { ast: null, diagnostics }
  try {
    const ast = cstToProgram(cst)
    return { ast, diagnostics }
  } catch (err) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.PARSE_ERROR,
        err instanceof Error ? err.message : String(err),
        'error',
        EMPTY_SPAN
      )
    )
    return { ast: null, diagnostics }
  }
}

export function parseModule(source: string): ParseResult {
  const diagnostics: Diagnostic[] = []
  const lexResult = AgileSoflLexer.tokenize(source)
  if (lexResult.errors.length > 0) {
    diagnostics.push(...lexErrorsToDiagnostics(lexResult.errors))
    return { ast: null, diagnostics }
  }
  parserInstance.input = lexResult.tokens
  const cst = parserInstance.module() as CstNode
  if (parserInstance.errors.length > 0) {
    diagnostics.push(...parseErrorsToDiagnostics())
  }
  if (!cst) return { ast: null, diagnostics }
  try {
    const ast = cstToModuleAst(cst)
    return { ast, diagnostics }
  } catch (err) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.PARSE_ERROR,
        err instanceof Error ? err.message : String(err),
        'error',
        EMPTY_SPAN
      )
    )
    return { ast: null, diagnostics }
  }
}
