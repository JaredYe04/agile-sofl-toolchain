import type { AspecDocument, InformalModule, RefineOptions, RefineResult, TraceLink, TraceabilityGraph } from '../model.js'
import { resolveModuleParents } from '../resolveParents.js'
import { contentHash } from '../buildInformalModel.js'
import {
  aspecCommentTag,
  buildFunctionBody,
  buildFunctionSignature,
  buildProcessFsf,
  buildProcessSignature,
  mapTypeHint
} from './fsfBuilder.js'
import { mergeExistingAsfl } from './mergeAsfl.js'
import type { AspecDiagnostic } from '../model.js'

function moduleHeader(mod: InformalModule): string {
  if (mod.parentModuleName) {
    return `module ${mod.name} / ${mod.parentModuleName};`
  }
  return `module ${mod.name};`
}

function renderModule(mod: InformalModule, warnings: AspecDiagnostic[], skeletonOnly: boolean): string {
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
      lines.push(`    ${inv.textHint?.trim() || 'true'};`)
    }
  }

  for (const proc of mod.processes ?? []) {
    lines.push(`process ${proc.name} ${buildProcessSignature(proc)}`)
    if (!skeletonOnly) {
      lines.push('    FSF :')
      lines.push('    ' + buildProcessFsf(proc).split('\n').join('\n    '))
    } else {
      lines.push('    FSF :')
      lines.push('    others && true')
    }
    if (proc.decomposition?.trim()) {
      lines.push(`    decom: ${proc.decomposition.trim()}`)
    }
    lines.push('    ' + aspecCommentTag(proc.id, proc.notes ?? proc.description))
    lines.push('end_process')
  }

  for (const fn of mod.functions ?? []) {
    lines.push(`function ${fn.name} ${buildFunctionSignature(fn)}`)
    lines.push(`    == ${skeletonOnly ? 'undefined' : buildFunctionBody(fn)}`)
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

  const moduleTexts = document.modules.map((m) => renderModule(m, warnings, skeletonOnly))
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
