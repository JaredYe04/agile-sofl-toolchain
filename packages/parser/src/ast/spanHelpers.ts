/**
 * CST/token span helpers for precise AST locations.
 */

import type { CstNode, IToken } from 'chevrotain'
import { spanFromToken, mergeSpans, EMPTY_SPAN, type Span } from './span.js'

export function spanOfToken(token: IToken | undefined): Span {
  if (!token) return EMPTY_SPAN
  const start = token.startOffset ?? 0
  const end = (token.endOffset ?? start) + 1
  return spanFromToken(start, end, token.startLine ?? 1, token.startColumn ?? 1)
}

export function spanFromLocation(loc: {
  startOffset?: number
  endOffset?: number
  startLine?: number
  startColumn?: number
}): Span {
  const start = loc.startOffset ?? 0
  const end = (loc.endOffset ?? start) + 1
  return spanFromToken(start, end, loc.startLine ?? 1, loc.startColumn ?? 1)
}

function tokensOf(node: CstNode, name: string): IToken[] {
  const arr = node.children[name]
  if (!Array.isArray(arr)) return []
  return arr.filter((item): item is IToken => !!item && 'tokenType' in item)
}

export function spanOfIdentifier(cst: CstNode, index = 0): Span {
  const ids = tokensOf(cst, 'Identifier')
  return spanOfToken(ids[index])
}

export function spanOfTokens(tokens: IToken[]): Span {
  if (tokens.length === 0) return EMPTY_SPAN
  return tokens.reduce((acc, token) => mergeSpans(acc, spanOfToken(token)), spanOfToken(tokens[0]))
}

export function spanOfChildren(cst: CstNode): Span {
  let result = EMPTY_SPAN
  let hasAny = false

  const absorb = (span: Span) => {
    if (span.end <= span.start) return
    result = hasAny ? mergeSpans(result, span) : span
    hasAny = true
  }

  const walk = (node: CstNode | IToken | undefined): void => {
    if (!node) return
    if ('image' in node && 'startOffset' in node) {
      absorb(spanOfToken(node as IToken))
      return
    }
    const child = node as CstNode
    if (child.location) absorb(spanFromLocation(child.location))
    if (!child.children) return
    for (const value of Object.values(child.children)) {
      if (!Array.isArray(value)) continue
      for (const item of value) walk(item as CstNode | IToken)
    }
  }

  walk(cst)
  return hasAny ? result : EMPTY_SPAN
}
