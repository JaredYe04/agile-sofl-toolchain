/**
 * Human-readable symbol summaries for CLI inspect and LSP hover.
 */

import type {
  ModuleNode,
  ProcessNode,
  FunctionNode,
  ParamGroupNode,
  TextWithSpan,
  MaybeTextWithSpan
} from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import type { SymbolEntry } from '../scope/resolver.js'
import { typeExprToInternal, resolveInternalType, typeToString } from '../typecheck/types.js'

export interface SymbolSummaryInput {
  symbol: SymbolEntry
  module: ModuleNode
  process?: ProcessNode | null
  function?: FunctionNode | null
  /** Markdown formatting (LSP hover); plain text when false (CLI). */
  markdown?: boolean
}

function md(text: string, markdown: boolean, kind: 'bold' | 'code' = 'code'): string {
  if (!markdown) return text
  return kind === 'bold' ? `**${text}**` : `\`${text}\``
}

function buildTypeEnv(module: ModuleNode): Map<string, ReturnType<typeof typeExprToInternal>> {
  const env = new Map<string, ReturnType<typeof typeExprToInternal>>()
  for (const t of module.types) {
    env.set(t.name, typeExprToInternal(t.typeExpr))
  }
  for (const t of module.types) {
    env.set(t.name, resolveInternalType(env.get(t.name)!, env))
  }
  for (const v of module.vars) {
    env.set(v.variable.name, resolveInternalType(typeExprToInternal(v.typeExpr), env))
  }
  return env
}

function formatParamGroups(groups: ParamGroupNode[], env: Map<string, ReturnType<typeof typeExprToInternal>>): string {
  const parts: string[] = []
  for (const g of groups) {
    const typeStr = typeToString(resolveInternalType(typeExprToInternal(g.typeExpr), env))
    for (const name of g.names) {
      parts.push(`${name}: ${typeStr}`)
    }
  }
  return parts.join(', ')
}

function symbolTypeString(input: SymbolSummaryInput): string | undefined {
  const { symbol, module, process, function: fn } = input
  const env = buildTypeEnv(module)

  if (symbol.kind === 'type') {
    const decl = module.types.find((t) => t.name === symbol.name)
    if (decl) return typeToString(resolveInternalType(typeExprToInternal(decl.typeExpr), env))
  }
  if (symbol.kind === 'var') {
    const decl = module.vars.find((v) => v.variable.name === symbol.name)
    if (decl) return typeToString(resolveInternalType(typeExprToInternal(decl.typeExpr), env))
    if (process) {
      for (const group of [...process.inputs, ...process.outputs]) {
        if (group.names.includes(symbol.name)) {
          return typeToString(resolveInternalType(typeExprToInternal(group.typeExpr), env))
        }
      }
      for (const ext of process.body?.ext ?? []) {
        if (ext.name === symbol.name && ext.typeExpr) {
          return typeToString(resolveInternalType(typeExprToInternal(ext.typeExpr), env))
        }
      }
    }
  }
  if (symbol.kind === 'function' && fn) {
    return typeToString(resolveInternalType(typeExprToInternal(fn.returnType), env))
  }
  return undefined
}

function processIoLines(process: ProcessNode, env: Map<string, ReturnType<typeof typeExprToInternal>>, markdown: boolean): string[] {
  const lines: string[] = []
  if (process.inputs.length) {
    lines.push(`${md('inputs', markdown, 'bold')}: ${formatParamGroups(process.inputs, env)}`)
  }
  if (process.outputs.length) {
    lines.push(`${md('outputs', markdown, 'bold')}: ${formatParamGroups(process.outputs, env)}`)
  }
  if (process.body?.ext.length) {
    const extParts = process.body.ext.map((e) => {
      const t = e.typeExpr
        ? typeToString(resolveInternalType(typeExprToInternal(e.typeExpr), env))
        : '?'
      return `${e.access} ${e.name}: ${t}`
    })
    lines.push(`${md('ext', markdown, 'bold')}: ${extParts.join(', ')}`)
  }
  return lines
}

function fsfSummary(process: ProcessNode, markdown: boolean): string | undefined {
  const fsf = process.body?.fsf
  if (!fsf) return undefined
  const count = fsf.scenarios.length + (fsf.others ? 1 : 0)
  return `${md('FSF', markdown, 'bold')}: ${count} branch${count === 1 ? '' : 'es'} (${fsf.scenarios.length} scenario${fsf.scenarios.length === 1 ? '' : 's'}${fsf.others ? ' + others' : ''})`
}

function functionSignature(fn: FunctionNode, env: Map<string, ReturnType<typeof typeExprToInternal>>): string {
  const params = formatParamGroups(fn.params, env)
  const ret = typeToString(resolveInternalType(typeExprToInternal(fn.returnType), env))
  return `${fn.name}(${params}): ${ret}`
}

/** Format a symbol summary for hover or inspect output. */
export function formatSymbolSummary(input: SymbolSummaryInput): string {
  const { symbol, module, process, function: fn, markdown = true } = input
  const env = buildTypeEnv(module)
  const lines: string[] = []

  lines.push(`${md(symbol.kind, markdown, 'bold')} ${md(symbol.name, markdown)} in module ${md(symbol.moduleName, markdown)}`)

  const typeStr = symbolTypeString(input)
  if (typeStr) {
    lines.push(`${md('type', markdown, 'bold')}: ${typeStr}`)
  }

  if (symbol.kind === 'process' && process) {
    lines.push(...processIoLines(process, env, markdown))
    const fsf = fsfSummary(process, markdown)
    if (fsf) lines.push(fsf)
    const decom = textOf(process.body?.decomposition)
    if (decom) lines.push(`${md('decom', markdown, 'bold')}: ${decom}`)
    const comment = textOf(process.body?.comment)
    if (comment) lines.push(`${md('comment', markdown, 'bold')}: ${comment}`)
  }

  if (symbol.kind === 'function' && fn) {
    lines.push(`${md('signature', markdown, 'bold')}: ${functionSignature(fn, env)}`)
    const fsf = fn.fsf
    if (fsf) {
      const count = fsf.scenarios.length + (fsf.others ? 1 : 0)
      lines.push(`${md('FSF', markdown, 'bold')}: ${count} branch${count === 1 ? '' : 'es'}`)
    }
  }

  return lines.join('\n\n')
}

/** Hover template for informal predicate text. */
export function formatInformalSummary(text: string, markdown = true): string {
  return `${md('informal', markdown, 'bold')} predicate\n\n${text}`
}

/** Hover template for process comment/decomposition regions. */
export function formatTextFieldSummary(
  field: 'comment' | 'decom',
  value: MaybeTextWithSpan | undefined,
  markdown = true
): string | undefined {
  const text = textOf(value)
  if (!text) return undefined
  return `${md(field, markdown, 'bold')}\n\n${text}`
}

export function textFieldSpan(value: MaybeTextWithSpan | undefined): TextWithSpan['span'] | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? undefined : value.span
}
