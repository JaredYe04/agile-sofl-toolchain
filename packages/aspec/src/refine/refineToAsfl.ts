import type { AspecDocument, InformalModule, InformalProcess, RefineOptions, RefineResult, TraceLink, TraceabilityGraph } from '../model.js'
import { resolveModuleParents } from '../resolveParents.js'
import { contentHash } from '../buildInformalModel.js'
import {
  aspecCommentTag,
  buildFunctionBody,
  buildFunctionFsf,
  buildFunctionSignature,
  buildProcessSignature,
  mapTypeHint,
  shouldRenderFunctionFsf
} from './fsfBuilder.js'
import { mergeExistingAsfl } from './mergeAsfl.js'
import { buildGuiBlockForRefine } from './guiBlockBuilder.js'
import type { AspecDiagnostic } from '../model.js'

/** Informal English is allowed in pre/post; strip characters the clause lexer cannot keep. */
export function asflSafeClause(text: string): string {
  const cleaned = text
    .replace(/[''`]/g, '')
    .replace(/[.;!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'true'
}

export function asflSafeInvariant(text: string): string {
  const t = asflSafeClause(text)
  if (/^(forall|exists|forevery|forsome|true|false|not)\b/i.test(t) || /[=<>]|inset|notin|\|/.test(t)) {
    return t
  }
  return 'true'
}

function buildProcessPost(proc: InformalProcess): string {
  if (proc.postconditions?.trim()) return asflSafeClause(proc.postconditions)
  const scens = proc.scenarios ?? []
  const normal = scens.filter((s) => !s.condition.toLowerCase().includes('other'))
  if (normal.length === 0) return 'true'
  if (normal.length === 1) return asflSafeClause(normal[0]!.outcome)
  return asflSafeClause(
    normal
      .map((s, i) => {
        if (i === 0) return `if ${s.condition} then ${s.outcome}`
        if (i === normal.length - 1) return `else ${s.outcome}`
        return `else if ${s.condition} then ${s.outcome}`
      })
      .join(' ')
  )
}

function moduleHeader(mod: InformalModule): string {
  if (mod.parentModuleName) {
    return `module ${mod.name} / ${mod.parentModuleName};`
  }
  return `module ${mod.name};`
}

function renderModule(
  mod: InformalModule,
  warnings: AspecDiagnostic[],
  skeletonOnly: boolean,
  guiBlock?: string | null
): string {
  const lines: string[] = [moduleHeader(mod)]

  if (mod.constants?.length) {
    lines.push('const')
    for (const c of mod.constants) {
      lines.push(`    ${c.name} = ${c.valueHint ?? '0'};`)
    }
  }

  if (mod.types?.length) {
    lines.push('type')
    for (const t of mod.types) {
      const hint = mapTypeHint(t.typeHint, warnings, `types.${t.id}`)
      lines.push(`    ${t.name} = ${hint};`)
    }
  }

  if (mod.variables?.length) {
    lines.push('var')
    for (const v of mod.variables) {
      const hint = mapTypeHint(v.typeHint, warnings, `variables.${v.id}`)
      lines.push(`    ${v.name}: ${hint};`)
    }
  }

  if (mod.invariants?.length) {
    lines.push('inv')
    for (const inv of mod.invariants) {
      lines.push(`    ${asflSafeInvariant(inv.textHint?.trim() || 'true')};`)
    }
  }

  if (guiBlock) {
    lines.push(guiBlock.split('\n').join('\n'))
  }

  for (const proc of mod.processes ?? []) {
    lines.push(`process ${proc.name} ${buildProcessSignature(proc)}`)
    const extNames = (proc as { ext?: Array<{ access: string; name: string; typeHint?: string }> }).ext
    if (!skeletonOnly && Array.isArray(extNames) && extNames.length) {
      lines.push('    ext')
      for (const e of extNames) {
        lines.push(`    ${e.access} ${e.name}${e.typeHint ? `: ${e.typeHint}` : ''}`)
      }
    }
    const pre = asflSafeClause(proc.preconditions?.trim() || 'true')
    const post = buildProcessPost(proc)
    lines.push('    pre')
    lines.push(`        ${skeletonOnly ? 'true' : pre}`)
    lines.push('    post')
    lines.push(`        ${skeletonOnly ? 'true' : post}`)
    if (proc.decomposition?.trim()) {
      lines.push(`    decom: ${proc.decomposition.trim()}`)
    }
    lines.push('    ' + aspecCommentTag(proc.id, proc.notes ?? proc.description))
    lines.push('end_process')
  }

  for (const fn of mod.functions ?? []) {
    lines.push(`function ${fn.name} ${buildFunctionSignature(fn)}`)
    if (!skeletonOnly && shouldRenderFunctionFsf(fn)) {
      lines.push('    FSF :')
      lines.push(`    ${buildFunctionFsf(fn)}`)
    } else {
      lines.push(`    == ${skeletonOnly ? 'undefined' : buildFunctionBody(fn)}`)
    }
    lines.push('end_function')
  }

  lines.push('end_module')
  return lines.join('\n')
}

function buildLinks(document: AspecDocument): TraceLink[] {
  const links: TraceLink[] = []
  for (const mod of document.modules) {
    links.push({ aspecId: mod.id, kind: 'module', asflSymbol: mod.name, status: 'covered' })
    for (const p of mod.processes ?? []) {
      links.push({ aspecId: p.id, kind: 'process', asflSymbol: p.name, status: 'covered' })
      for (const s of p.scenarios ?? []) {
        links.push({ aspecId: s.id, kind: 'scenario', asflSymbol: p.name, status: 'covered' })
      }
    }
    for (const f of mod.functions ?? []) {
      links.push({ aspecId: f.id, kind: 'function', asflSymbol: f.name, status: 'covered' })
    }
  }
  return links
}

export function refineToAsfl(
  document: AspecDocument,
  source: string,
  options: RefineOptions = {}
): RefineResult {
  resolveModuleParents(document)
  const warnings: AspecDiagnostic[] = []
  const skeletonOnly = options.skeletonOnly ?? false
  const guiBlock =
    options.emitGuiBlock !== false ? buildGuiBlockForRefine(source, options.guiSource) : null

  const moduleTexts = document.modules.map((m, i) =>
    renderModule(m, warnings, skeletonOnly, i === 0 ? guiBlock : null)
  )
  let asflText = moduleTexts.join(';\n') + '\n'

  if (options.preserveExisting && options.existingAsfl?.trim()) {
    asflText = mergeExistingAsfl(asflText, options.existingAsfl, options.mergePlans)
  }

  const traceability: TraceabilityGraph = {
    traceVersion: '1.0',
    aspecUri: options.aspecUri,
    asflUri: options.asflUri ?? document.meta.hybridTarget,
    contentHash: contentHash(source),
    links: buildLinks(document)
  }

  return { asflText, traceability, warnings }
}

export function traceToJson(trace: TraceabilityGraph): string {
  return JSON.stringify(trace, null, 2) + '\n'
}
