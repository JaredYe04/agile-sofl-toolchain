/**
 * Hover provider.
 */

import {
  parse,
  resolveScope,
  resolveReference,
  resolveDeclarationAtOffset,
  resolveReferenceByName,
  findNodeAtOffset,
  formatSymbolSummary,
  formatInformalSummary,
  formatTextFieldSummary,
  textFieldSpan,
  typeExprToInternal,
  resolveInternalType,
  typeToString
} from '@agile-sofl/parser'
import type {
  ModuleNode,
  ProcessNode,
  FunctionNode,
  InformalTextNode,
  ProgramNode,
  PredicateNode,
  AtomicPredicateNode
} from '@agile-sofl/parser'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Hover, Position } from 'vscode-languageserver/node.js'
import { spanToRange } from './position.js'
import { hasParseError } from './parseGuard.js'
import { bindingAtOffset } from './bindings.js'
function moduleAtOffset(modules: ModuleNode[], offset: number): ModuleNode | null {
  let best: ModuleNode | null = null
  let bestLen = Infinity
  for (const mod of modules) {
    const { span } = mod
    if (span.end <= span.start) continue
    if (offset >= span.start && offset <= span.end && span.end - span.start < bestLen) {
      best = mod
      bestLen = span.end - span.start
    }
  }
  return best
}

function processAtOffset(mod: ModuleNode, offset: number): ProcessNode | null {
  for (const proc of mod.processes) {
    if (offset >= proc.span.start && offset <= proc.span.end) return proc
  }
  return null
}

function functionAtOffset(mod: ModuleNode, offset: number): FunctionNode | null {
  for (const fn of mod.functions) {
    if (offset >= fn.span.start && offset <= fn.span.end) return fn
  }
  return null
}

function walkAtomInformal(atom: AtomicPredicateNode, offset: number, best: { node: InformalTextNode | null; len: number }): void {
  if (atom.type === 'informal_text') {
    const { span } = atom
    if (span.end > span.start && offset >= span.start && offset <= span.end && span.end - span.start < best.len) {
      best.node = atom
      best.len = span.end - span.start
    }
    return
  }
  if (atom.type === 'not_predicate') {
    walkAtomInformal(atom.operand, offset, best)
    return
  }
  if (atom.type === 'paren_predicate') {
    walkAtomInformal(atom.inner, offset, best)
    return
  }
  if (atom.type === 'quantified') {
    walkPredicateInformal(atom.body, offset, best)
    for (const nested of atom.nestedQuantifiers) {
      walkPredicateInformal(nested.body, offset, best)
    }
  }
}

function walkPredicateInformal(pred: PredicateNode, offset: number, best: { node: InformalTextNode | null; len: number }): void {
  for (const conj of pred.disjuncts) {
    for (const atom of conj.atoms) {
      walkAtomInformal(atom, offset, best)
    }
  }
}

function findInformalAtOffset(program: ProgramNode, offset: number): InformalTextNode | null {
  const best = { node: null as InformalTextNode | null, len: Infinity }
  for (const mod of program.modules) {
    for (const inv of mod.invariants) {
      walkPredicateInformal(inv.condition, offset, best)
    }
    for (const proc of mod.processes) {
      const fsf = proc.body?.fsf
      if (!fsf) continue
      for (const sc of fsf.scenarios) {
        walkPredicateInformal(sc.test, offset, best)
        walkPredicateInformal(sc.def, offset, best)
      }
      if (fsf.others) walkPredicateInformal(fsf.others, offset, best)
    }
    for (const fn of mod.functions) {
      if (!fn.fsf) continue
      for (const sc of fn.fsf.scenarios) {
        walkPredicateInformal(sc.test, offset, best)
      }
    }
  }
  return best.node
}

function hoverForTextFields(document: TextDocument, mod: ModuleNode, offset: number): Hover | null {
  for (const proc of mod.processes) {
    const decom = proc.body?.decomposition
    const decomSpan = textFieldSpan(decom)
    if (decomSpan && offset >= decomSpan.start && offset <= decomSpan.end) {
      const content = formatTextFieldSummary('decom', decom)
      if (content) {
        return { contents: { kind: 'markdown', value: content }, range: spanToRange(document, decomSpan) }
      }
    }
    const comment = proc.body?.comment
    const commentSpan = textFieldSpan(comment)
    if (commentSpan && offset >= commentSpan.start && offset <= commentSpan.end) {
      const content = formatTextFieldSummary('comment', comment)
      if (content) {
        return { contents: { kind: 'markdown', value: content }, range: spanToRange(document, commentSpan) }
      }
    }
  }
  return null
}

export function getHover(document: TextDocument, position: Position): Hover | null {
  const source = document.getText()
  if (hasParseError(source)) return null

  const offset = document.offsetAt(position)
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return null

  const informal = findInformalAtOffset(ast, offset)
  if (informal) {
    return {
      contents: { kind: 'markdown', value: formatInformalSummary(informal.text) },
      range: spanToRange(document, informal.span)
    }
  }

  const currentMod = moduleAtOffset(ast.modules, offset)
  if (currentMod) {
    const fieldHover = hoverForTextFields(document, currentMod, offset)
    if (fieldHover) return fieldHover
  }

  const compBinding = bindingAtOffset(ast, offset, source)
  if (compBinding && currentMod) {
    const env = new Map<string, ReturnType<typeof typeExprToInternal>>()
    for (const t of currentMod.types) {
      env.set(t.name, typeExprToInternal(t.typeExpr))
    }
    for (const t of currentMod.types) {
      env.set(t.name, resolveInternalType(env.get(t.name)!, env))
    }
    for (const v of currentMod.vars) {
      env.set(v.variable.name, resolveInternalType(typeExprToInternal(v.typeExpr), env))
    }
    const typeStr = typeToString(resolveInternalType(typeExprToInternal(compBinding.typeExpr), env))
    return {
      contents: {
        kind: 'markdown',
        value: `**comprehension binding** \`${compBinding.name}\`\n\n**type**: ${typeStr}`
      },
      range: spanToRange(document, compBinding.span)
    }
  }

  const scopeResult = resolveScope(ast)
  let target =
    resolveReference(ast, scopeResult, offset) ?? resolveDeclarationAtOffset(ast, scopeResult, offset)

  if (!target) {
    const node = findNodeAtOffset(ast, offset)
    if (node?.type === 'call' && typeof node.callee !== 'string' && node.callee.type === 'identifier') {
      const currentMod = moduleAtOffset(ast.modules, offset)
      if (currentMod) {
        target = resolveReferenceByName(scopeResult, currentMod, node.callee.name, node.callee.qualified?.module, offset)
      }
    }
  }

  if (!target) return null

  const { symbol, module } = target
  const process =
    symbol.kind === 'process'
      ? (module.processes.find((p) => p.name === symbol.name) ?? processAtOffset(module, offset))
      : processAtOffset(module, offset)
  const fn =
    symbol.kind === 'function'
      ? (module.functions.find((f) => f.name === symbol.name) ?? functionAtOffset(module, offset))
      : functionAtOffset(module, offset)

  const content = formatSymbolSummary({ symbol, module, process, function: fn, markdown: true })

  return {
    contents: { kind: 'markdown', value: content },
    range: spanToRange(document, target.span)
  }
}
