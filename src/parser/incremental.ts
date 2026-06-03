/**
 * Incremental check with module-level content hashing and result caching.
 */

import { createHash } from 'node:crypto'
import type { ProgramNode } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { parseStrict } from '../parser/parse.js'
import { resolveScope } from '../scope/resolver.js'
import { checkReferences } from '../scope/referenceChecker.js'
import { typeCheck } from '../typecheck/checker.js'
import { classifyFsf } from '../fsf/classifier.js'

export interface CheckResult {
  ast: ProgramNode | null
  diagnostics: Diagnostic[]
}

function runCheck(source: string): CheckResult {
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

export interface IncrementalCheckState {
  contentHash: string
  moduleHashes: Record<string, string>
  ast: ProgramNode | null
  diagnostics: Diagnostic[]
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

export function moduleSourceHashes(source: string, ast: ProgramNode): Record<string, string> {
  const out: Record<string, string> = {}
  for (const mod of ast.modules) {
    if (mod.span.end > mod.span.start) {
      out[mod.name] = hashText(source.slice(mod.span.start, mod.span.end))
    }
  }
  return out
}

export function getChangedModules(
  source: string,
  ast: ProgramNode,
  previous?: IncrementalCheckState
): string[] {
  if (!previous) return ast.modules.map((m) => m.name)
  const next = moduleSourceHashes(source, ast)
  return ast.modules.filter((m) => previous.moduleHashes[m.name] !== next[m.name]).map((m) => m.name)
}

/** Reuses full result when source unchanged; tracks per-module hashes for editors. */
export function checkIncremental(
  source: string,
  previous?: IncrementalCheckState
): CheckResult & { state: IncrementalCheckState } {
  const contentHash = hashText(source)
  if (previous?.contentHash === contentHash) {
    return { ast: previous.ast, diagnostics: previous.diagnostics, state: previous }
  }

  const result = runCheck(source)
  const state: IncrementalCheckState = {
    contentHash,
    moduleHashes: result.ast ? moduleSourceHashes(source, result.ast) : {},
    ast: result.ast,
    diagnostics: result.diagnostics
  }
  return { ...result, state }
}

export function createIncrementalState(source: string): IncrementalCheckState {
  return checkIncremental(source).state
}
