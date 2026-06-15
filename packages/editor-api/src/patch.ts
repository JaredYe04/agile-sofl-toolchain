import { parse, printProgram, textOf } from '@agile-sofl/parser'
import type { ProgramNode } from '@agile-sofl/parser'
import type { Span } from '@agile-sofl/parser'
import { findProcess } from './documentModel.js'
import type { FsfScenarioDto } from './fsfModel.js'

function replaceSpan(source: string, span: { start: number; end: number }, replacement: string): string {
  return source.slice(0, span.start) + replacement + source.slice(span.end)
}

/** Replace the full source line containing valueSpan (keeps leading indent). */
function replaceFieldLine(
  source: string,
  valueSpan: { start: number; end: number },
  lineText: string
): string {
  let lineStart = valueSpan.start
  while (lineStart > 0 && source[lineStart - 1] !== '\n') {
    lineStart -= 1
  }
  let lineEnd = valueSpan.end
  while (lineEnd < source.length && source[lineEnd] !== '\n') {
    lineEnd += 1
  }
  const indent = source.slice(lineStart, valueSpan.start).match(/^(\s*)/)?.[1] ?? ''
  return source.slice(0, lineStart) + indent + lineText + source.slice(lineEnd)
}

function buildFsfBody(scenarios: FsfScenarioDto[], others?: string): string {
  const lines = scenarios.map((s) => `${s.test.trim()} && ${s.def.trim()}`)
  if (others?.trim()) {
    lines.push(`others && ${others.trim()}`)
  }
  return lines.map((line, i) => (i < lines.length - 1 ? `${line} ||` : line)).join('\n')
}

function fsfPatchSpan(source: string, fsf: { span: { start: number; end: number } }): {
  start: number
  end: number
} {
  const header = source.lastIndexOf('FSF :', fsf.span.start)
  if (header >= 0 && fsf.span.start - header <= 8) {
    return { start: header, end: fsf.span.end }
  }
  return fsf.span
}

export function patchFsfSpec(
  source: string,
  processName: string,
  scenarios: FsfScenarioDto[],
  others?: string
): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const proc = findProcess(ast, processName)
  const fsf = proc?.body?.fsf
  if (!fsf) return source
  const block = `FSF :\n${buildFsfBody(scenarios, others)}`
  return replaceSpan(source, fsfPatchSpan(source, fsf), block)
}

export function patchComment(source: string, processName: string, text: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const proc = findProcess(ast, processName)
  if (!proc?.body) return source
  const replacement = `comment: ${text}`
  if (proc.body.comment) {
    return replaceFieldLine(source, textSpan(proc.body.comment), replacement)
  }
  const insertAt = proc.body.fsf?.span.end ?? proc.body.ext.at(-1)?.span.end ?? proc.span.end
  return source.slice(0, insertAt) + `\n${replacement}` + source.slice(insertAt)
}

export function patchDecom(source: string, processName: string, text: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  const proc = findProcess(ast, processName)
  if (!proc?.body) return source
  const replacement = `decom: ${text}`
  if (proc.body.decomposition) {
    return replaceFieldLine(source, textSpan(proc.body.decomposition), replacement)
  }
  const insertAt = proc.body.fsf?.span.end ?? proc.body.ext.at(-1)?.span.end ?? proc.span.end
  return source.slice(0, insertAt) + `\n${replacement}` + source.slice(insertAt)
}

export function patchInformal(
  source: string,
  span: { start: number; end: number },
  text: string
): string {
  return replaceSpan(source, span, text)
}

export function patchInvariant(
  source: string,
  span: { start: number; end: number },
  text: string
): string {
  return replaceSpan(source, span, text.trim())
}

export function formatDocument(source: string): string {
  const { ast } = parse(source)
  if (!ast || ast.type !== 'program') return source
  return printProgram(ast)
}

function textSpan(field: { span: Span } | string | undefined): Span {
  if (!field || typeof field === 'string') {
    return { start: 0, end: 0, line: 1, column: 1 }
  }
  return field.span
}

export function patchProcessCommentFromAst(ast: ProgramNode, source: string, processName: string, text: string): string {
  void ast
  return patchComment(source, processName, text)
}

function pushInformalFromPredicate(
  spans: Array<{
    processName: string
    field: 'comment' | 'decom' | 'fsf'
    text: string
    span: { start: number; end: number }
  }>,
  processName: string,
  pred: { disjuncts?: Array<{ atoms?: Array<{ type: string; text?: string; span: Span }> }> } | undefined
): void {
  if (!pred) return
  for (const conj of pred.disjuncts ?? []) {
    for (const a of conj.atoms ?? []) {
      if (a.type === 'informal_text' && a.text) {
        spans.push({ processName, field: 'fsf', text: a.text, span: a.span })
      }
    }
  }
}

export function getInformalSpans(source: string, ast: ProgramNode) {
  const spans: Array<{
    processName: string
    field: 'comment' | 'decom' | 'fsf'
    text: string
    span: { start: number; end: number }
  }> = []
  for (const mod of ast.modules) {
    for (const proc of mod.processes) {
      if (proc.body?.comment && textOf(proc.body.comment)) {
        spans.push({
          processName: proc.name,
          field: 'comment',
          text: textOf(proc.body.comment)!,
          span: textSpan(proc.body.comment)
        })
      }
      if (textOf(proc.body?.decomposition)) {
        spans.push({
          processName: proc.name,
          field: 'decom',
          text: textOf(proc.body!.decomposition)!,
          span: textSpan(proc.body!.decomposition)
        })
      }
      const fsf = proc.body?.fsf
      if (fsf) {
        for (const scen of fsf.scenarios) {
          pushInformalFromPredicate(spans, proc.name, scen.test)
        }
        pushInformalFromPredicate(spans, proc.name, fsf.others)
      }
    }
  }
  void source
  return spans
}
