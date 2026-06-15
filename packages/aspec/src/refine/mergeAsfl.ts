import { parse } from '@agile-sofl/parser'
import type { ProgramNode, ProcessNode, Span } from '@agile-sofl/parser'

import type { MergeStrategy, ProcessMergePlan } from '../model.js'

export type { MergeStrategy, ProcessMergePlan }

function spanOf(field: { span: Span } | string | undefined): Span | null {
  if (!field || typeof field === 'string') return null
  return field.span
}

function findProcessInProgram(ast: ProgramNode, name: string): ProcessNode | undefined {
  for (const mod of ast.modules) {
    const proc = mod.processes.find((p) => p.name === name)
    if (proc) return proc
  }
  return undefined
}

interface SpanReplace {
  start: number
  end: number
  text: string
}

/** Merge existing hybrid process bodies into freshly generated ASFL (process-level). */
export function mergeExistingAsfl(
  generated: string,
  existing: string,
  plans?: ProcessMergePlan[]
): string {
  if (!existing.trim()) return generated

  const { ast: genAst } = parse(generated)
  const { ast: existAst } = parse(existing)
  if (!genAst || genAst.type !== 'program' || !existAst || existAst.type !== 'program') {
    return generated
  }

  const replacements: SpanReplace[] = []

  for (const mod of genAst.modules) {
    for (const genProc of mod.processes) {
      const plan = plans?.find((p) => p.processName === genProc.name)
      const strategy: MergeStrategy = plan?.strategy ?? 'merge_fsf_only'
      if (strategy === 'use_generated') continue

      const existProc = findProcessInProgram(existAst, genProc.name)
      if (!existProc) continue

      if (strategy === 'keep_hybrid') {
        replacements.push({
          start: genProc.span.start,
          end: genProc.span.end,
          text: existing.slice(existProc.span.start, existProc.span.end)
        })
        continue
      }

      if (strategy === 'merge_fsf_only' && genProc.body?.fsf && existProc.body?.fsf) {
        const genFsf = genProc.body.fsf
        const existFsf = existProc.body.fsf
        replacements.push({
          start: genFsf.span.start,
          end: genFsf.span.end,
          text: existing.slice(existFsf.span.start, existFsf.span.end)
        })
        if (genProc.body.decomposition && existProc.body.decomposition) {
          const gSpan = spanOf(genProc.body.decomposition)
          const eSpan = spanOf(existProc.body.decomposition)
          if (gSpan && eSpan) {
            replacements.push({
              start: gSpan.start,
              end: gSpan.end,
              text: existing.slice(eSpan.start, eSpan.end)
            })
          }
        }
        if (genProc.body.comment && existProc.body.comment) {
          const gSpan = spanOf(genProc.body.comment)
          const eSpan = spanOf(existProc.body.comment)
          if (gSpan && eSpan) {
            replacements.push({
              start: gSpan.start,
              end: gSpan.end,
              text: existing.slice(eSpan.start, eSpan.end)
            })
          }
        }
      }
    }
  }

  replacements.sort((a, b) => b.start - a.start)
  let out = generated
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.text + out.slice(r.end)
  }
  return out
}
