import type { IToken } from 'chevrotain'
import type { ConditionClauseNode, ConditionKind } from '../ast/nodes.js'
import { EMPTY_SPAN, mergeSpans } from '../ast/span.js'
import { spanOfToken } from '../ast/spanHelpers.js'
import type { Span } from '../ast/span.js'

function tokensSpan(tokens: IToken[]): Span {
  if (tokens.length === 0) return EMPTY_SPAN
  const first = tokens[0]!
  const last = tokens[tokens.length - 1]!
  return mergeSpans(spanOfToken(first), spanOfToken(last))
}

function joinImages(tokens: IToken[]): string {
  return tokens.map((t) => t.image).join(' ').replace(/\s+/g, ' ').trim()
}

function tokenName(token: IToken): string {
  return token.tokenType?.name ?? ''
}

/**
 * Build a ConditionClause from a token stream collected after `pre` / `post`.
 * Recognizes if/then/else (and Otherwise) as structured nodes; leaves NL otherwise.
 */
export function interpretConditionTokens(tokens: IToken[], fallbackSpan: Span): ConditionClauseNode {
  const span = tokens.length ? tokensSpan(tokens) : fallbackSpan
  const text = joinImages(tokens)
  if (tokens.length === 0) {
    return { type: 'condition_clause', span, kind: 'natural-language', text: '' }
  }

  const ifIdx = tokens.findIndex((t) => tokenName(t) === 'If')
  const thenIdx = tokens.findIndex((t) => tokenName(t) === 'Then')
  let elseIdx = tokens.findIndex((t) => tokenName(t) === 'Else')
  if (elseIdx < 0) {
    elseIdx = tokens.findIndex((t) => t.image.toLowerCase() === 'otherwise')
  }

  if (ifIdx >= 0 && thenIdx > ifIdx) {
    const guardToks = tokens.slice(ifIdx + 1, thenIdx)
    const thenEnd = elseIdx > thenIdx ? elseIdx : tokens.length
    const thenToks = tokens.slice(thenIdx + 1, thenEnd)
    const elseToks = elseIdx > thenIdx ? tokens.slice(elseIdx + 1) : []
    return {
      type: 'condition_clause',
      span,
      kind: 'structured',
      text,
      conditional: {
        guard: interpretConditionTokens(guardToks, span),
        thenClause: interpretConditionTokens(thenToks, span),
        elseClause: elseToks.length ? interpretConditionTokens(elseToks, span) : undefined
      }
    }
  }

  const looksFormal = tokens.some((t) =>
    ['Equals', 'NotEqual', 'LessThan', 'GreaterThan', 'LessEqual', 'GreaterEqual', 'Inset', 'Notin'].includes(
      tokenName(t)
    )
  )
  const kind: ConditionKind = looksFormal ? 'formal' : 'natural-language'
  return { type: 'condition_clause', span, kind, text }
}

export function clauseHasInformal(clause: ConditionClauseNode | undefined): boolean {
  if (!clause) return false
  if (clause.kind === 'natural-language') return true
  if (clause.conditional) {
    return (
      clauseHasInformal(clause.conditional.guard) ||
      clauseHasInformal(clause.conditional.thenClause) ||
      clauseHasInformal(clause.conditional.elseClause)
    )
  }
  if (clause.predicate) {
    for (const d of clause.predicate.disjuncts) {
      for (const atom of d.atoms) {
        if (atom.type === 'informal_text') return true
      }
    }
  }
  return false
}

export function printConditionText(clause: ConditionClauseNode | undefined): string {
  if (!clause) return ''
  if (clause.kind === 'structured' && clause.conditional) {
    const g = printConditionText(clause.conditional.guard)
    const t = printConditionText(clause.conditional.thenClause)
    const e = clause.conditional.elseClause ? printConditionText(clause.conditional.elseClause) : ''
    return e ? `if ${g} then ${t} else ${e}` : `if ${g} then ${t}`
  }
  return (clause.text ?? '').trim()
}
