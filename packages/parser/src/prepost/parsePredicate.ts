import type { CstNode } from 'chevrotain'
import { AgileSoflLexer } from '../lexer/tokens.js'
import { parserInstance } from '../parser/parser.js'
import { cstToPredicate } from '../parser/cstToAst.js'
import type { PredicateNode } from '../ast/nodes.js'

/** Parse a standalone predicate fragment (no module wrapper). */
export function parsePredicateSource(source: string): PredicateNode | null {
  const trimmed = source.trim()
  if (!trimmed) return null
  const lex = AgileSoflLexer.tokenize(trimmed)
  if (lex.errors.length) return null
  const parser = parserInstance as unknown as {
    input: unknown
    errors: unknown[]
    predicate: () => CstNode
  }
  const prevInput = parser.input
  const prevErrors = parser.errors.slice()
  parser.input = lex.tokens
  parser.errors.length = 0
  const cst = parser.predicate()
  const failed = parser.errors.length > 0 || !cst
  parser.input = prevInput
  parser.errors.length = 0
  parser.errors.push(...prevErrors)
  if (failed) return null
  try {
    return cstToPredicate(cst)
  } catch {
    return null
  }
}
