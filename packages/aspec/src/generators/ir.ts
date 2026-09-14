import { toIdent, toSnakeIdent } from '../informal/ids.js'
import type { InformalNode, InformalSpecification } from '../informal/model.js'
import type {
  GenerationContext,
  HybridChangeItem,
  HybridGenerationResult,
  HybridProcessIR,
  HybridScenarioIR,
  HybridSpecificationIR,
  HybridTypeIR,
  SpecTraceLink
} from './types.js'
import type { AspecDocument, InformalProcess } from '../model.js'
import { refineToAsfl } from '../refine/refineToAsfl.js'
import { serializeInformalSpec } from '../informal/serializer.js'

function nested(node: InformalNode): InformalNode[] {
  return (node.metadata?.nested as InformalNode[] | undefined) ?? []
}

function isStructuralTitle(title: string): boolean {
  return /^(input|output|result|precondition|postcondition)s?$/i.test(title.trim())
}

function inferTypeHint(name: string, description?: string): string {
  const n = `${name} ${description ?? ''}`.toLowerCase()
  if (/\b(balance|amount|limit|rate|price|cash)\b/.test(n)) return 'real'
  if (/\b(id|number|count|qty|quantity|age|nat)\b/.test(n)) return 'nat'
  if (/\b(flag|valid|ok|bool)\b/.test(n)) return 'bool'
  return 'string'
}

function parseNamedItems(text: string | undefined): Array<{ name: string; typeHint: string }> {
  if (!text?.trim()) return []
  const items: Array<{ name: string; typeHint: string }> = []
  for (const line of text.split(/\n/)) {
    const bullet = line.replace(/^\s*[-*]\s*/, '').trim()
    if (!bullet) continue
    const name = toSnakeIdent(bullet.split(/[:–—-]/)[0] || bullet)
    items.push({ name, typeHint: inferTypeHint(name, bullet) })
  }
  return items
}

function foldSignature(node: InformalNode): Pick<HybridProcessIR, 'inputs' | 'outputs' | 'pre' | 'post'> {
  let inputs: HybridProcessIR['inputs'] = []
  let outputs: HybridProcessIR['outputs'] = []
  let pre: string | undefined
  let post: string | undefined
  for (const child of nested(node)) {
    const title = child.title.trim()
    if (/^inputs?$/i.test(title)) {
      inputs = parseNamedItems(child.description)
    } else if (/^(outputs?|results?)$/i.test(title)) {
      const parsed = parseNamedItems(child.description)
      outputs = parsed.length ? parsed : [{ name: 'result', typeHint: 'string' }]
      if (!parsed.length && child.description?.trim()) post = child.description.trim()
    } else if (/^preconditions?$/i.test(title)) {
      pre = child.description?.trim()
    } else if (/^postconditions?$/i.test(title)) {
      post = child.description?.trim()
    }
  }
  return { inputs, outputs, pre, post }
}

export function informalToHybridIR(spec: InformalSpecification): HybridSpecificationIR {
  const title = spec.metadata.title || spec.moduleId || 'System'
  const ident = toIdent(title.replace(/Informal Specification/i, '').trim() || spec.moduleId)
  const moduleName = ident.startsWith('SYSTEM_') ? ident : `SYSTEM_${ident}`

  const functions = spec.sections.find((s) => s.type === 'functions')?.children ?? []
  const data = spec.sections.find((s) => s.type === 'data-resources')?.children ?? []
  const constraints = spec.sections.find((s) => s.type === 'constraints')?.children ?? []

  const types: HybridTypeIR[] = []
  const variables: HybridSpecificationIR['variables'] = []
  for (const resource of data) {
    const fields = nested(resource)
    const typeName = toIdent(resource.title)
    types.push({
      name: typeName,
      informalId: resource.id,
      fields: fields.map((f) => ({
        name: toSnakeIdent(f.title),
        typeHint: inferTypeHint(f.title, f.description),
        description: f.description
      }))
    })
    const isCollection = /file|list|set|accounts|users/i.test(resource.title)
    variables.push({
      name: toSnakeIdent(resource.title),
      typeHint: fields.length ? (isCollection ? `set of ${typeName}` : typeName) : inferTypeHint(resource.title, resource.description),
      informalId: resource.id
    })
  }

  const processes: HybridProcessIR[] = []
  const walk = (node: InformalNode) => {
    if (isStructuralTitle(node.title)) return
    const children = nested(node)
    const behavioral = children.filter((c) => !isStructuralTitle(c.title))
    const folded = foldSignature(node)
    const scenarios: HybridScenarioIR[] = behavioral.map((c) => ({
      id: c.id,
      name: toIdent(c.title),
      guard: c.description?.trim() || c.title,
      definingCondition: c.description?.trim() || c.title,
      exceptional: /fail|error|invalid|unknown|not exist/i.test(`${c.title} ${c.description ?? ''}`)
    }))
    const pre = folded.pre || node.description?.trim() || 'true'
    const post =
      folded.post ||
      (scenarios.length
        ? scenarios
            .filter((s) => !s.exceptional)
            .map((s, i, arr) =>
              arr.length === 1 ? s.definingCondition : i === 0 ? `if ${s.guard} then ${s.definingCondition}` : `else ${s.definingCondition}`
            )
            .join(' ')
        : node.description?.trim())
    processes.push({
      name: toIdent(node.title),
      informalId: node.id,
      description: node.description,
      inputs: folded.inputs,
      outputs: folded.outputs.length ? folded.outputs : [{ name: 'result', typeHint: 'string' }],
      pre,
      post,
      preconditions: pre ? [pre] : [],
      postconditions: post ? [post] : [],
      scenarios,
      children: behavioral.map((c) => toIdent(c.title)),
      formalizationStatus: 'semi-formal'
    })
    for (const child of behavioral) {
      if (nested(child).some((c) => isStructuralTitle(c.title))) walk(child)
    }
  }
  for (const fn of functions) walk(fn)

  return {
    moduleName,
    types,
    variables,
    processes,
    invariants: constraints.map((c) => ({
      name: toIdent(c.title),
      informalId: c.id,
      description: c.description?.trim() || c.title
    }))
  }
}

export function hybridIRToAspec(spec: InformalSpecification, ir: HybridSpecificationIR): AspecDocument {
  const modules = ir.modules?.length
    ? ir.modules
    : [
        {
          id: `mod-${spec.moduleId}`,
          name: ir.moduleName,
          types: ir.types,
          variables: ir.variables,
          processes: ir.processes,
          invariants: ir.invariants
        }
      ]

  return {
    aspecVersion: '1.0',
    meta: {
      id: spec.id,
      title: spec.metadata.title ?? ir.moduleName,
      hybridTarget: spec.metadata.hybridTarget
    },
    system: {
      name: ir.moduleName.replace(/^SYSTEM_/, ''),
      purpose: spec.metadata.title ?? ir.moduleName
    },
    modules: modules.map((m, mi) => {
      const processes: InformalProcess[] = m.processes.map((p) => ({
        id: p.informalId ?? p.id ?? `proc-${p.name}`,
        name: p.name,
        description: p.description,
        signature: {
          inputs: p.inputs.map((i) => ({ name: i.name, typeHint: i.typeHint })),
          outputs: p.outputs.map((o) => ({ name: o.name, typeHint: o.typeHint }))
        },
        preconditions: p.pre || p.preconditions.join('\n') || undefined,
        postconditions: p.post || p.postconditions.join('\n') || undefined,
        scenarios: (p.scenarios ?? []).map((s, i) => ({
          id: s.id ?? `${p.informalId ?? p.name}-s${i + 1}`,
          condition: s.guard,
          outcome: s.definingCondition
        })),
        decomposition: p.children?.length ? `${p.name}_Decom` : undefined
      }))
      return {
        id: m.id ?? `mod-${spec.moduleId}-${mi}`,
        name: m.name,
        description: spec.metadata.title ?? m.name,
        types: m.types.map((t) => ({
          id: t.informalId ?? t.id ?? `type-${t.name}`,
          name: t.name,
          typeHint: t.fields.length
            ? `composed of ${t.fields.map((f) => `${f.name}: ${f.typeHint}`).join(' ')} end`
            : 'string',
          description: t.fields.map((f) => f.description).filter(Boolean).join('; ')
        })),
        variables: m.variables.map((v) => ({
          id: v.informalId ?? `var-${v.name}`,
          name: v.name,
          typeHint: v.typeHint
        })),
        invariants: m.invariants.map((inv) => ({
          id: inv.informalId ?? inv.id ?? `inv-${inv.name}`,
          description: inv.description || inv.name,
          textHint: inv.description || 'true'
        })),
        processes
      }
    })
  }
}

function changeItems(ir: HybridSpecificationIR): HybridChangeItem[] {
  const items: HybridChangeItem[] = []
  for (const t of ir.types) {
    items.push({ id: `type-${t.name}`, kind: 'type', name: t.name, summary: `Type ${t.name}`, selected: true })
  }
  for (const v of ir.variables) {
    items.push({ id: `var-${v.name}`, kind: 'variable', name: v.name, summary: `Variable ${v.name}`, selected: true })
  }
  for (const p of ir.processes) {
    items.push({
      id: p.informalId ?? `proc-${p.name}`,
      kind: 'process',
      name: p.name,
      summary: `Process ${p.name}${p.scenarios?.length ? ` (${p.scenarios.length} scenarios)` : ''}`,
      selected: true
    })
    for (const s of p.scenarios ?? []) {
      items.push({
        id: s.id ?? `${p.name}-${s.name}`,
        kind: 'scenario',
        name: s.name ?? 'Scenario',
        summary: `${p.name} / ${s.name ?? 'scenario'}`,
        selected: true
      })
    }
  }
  for (const inv of ir.invariants) {
    items.push({ id: inv.informalId ?? `inv-${inv.name}`, kind: 'invariant', name: inv.name, summary: `Invariant ${inv.name}`, selected: true })
  }
  return items
}

function scenarioPost(scenarios: HybridScenarioIR[]): string {
  const normal = scenarios.filter((s) => !s.exceptional)
  if (!normal.length) return 'true'
  if (normal.length === 1) return normal[0]!.definingCondition
  return normal
    .map((s, i) => {
      if (i === 0) return `if ${s.guard} then ${s.definingCondition}`
      if (i === normal.length - 1) return `else ${s.definingCondition}`
      return `else if ${s.guard} then ${s.definingCondition}`
    })
    .join(' ')
}

function idHit(ids: Set<string>, ...candidates: Array<string | undefined>): boolean {
  return candidates.some((c) => Boolean(c && ids.has(c)))
}

export function filterHybridIR(ir: HybridSpecificationIR, context: GenerationContext = {}): HybridSpecificationIR {
  let types = ir.types
  let variables = ir.variables
  let processes = ir.processes
  let invariants = ir.invariants
  const stages = context.params?.stages

  if (stages && !stages.hybridSpec) {
    if (stages.typesVars === false) {
      types = []
      variables = []
    }
    if (stages.invariants === false) invariants = []
    if (!stages.processes && !stages.scenarios) processes = []
    else if (!stages.scenarios) {
      processes = processes.map((p) => ({ ...p, scenarios: [] }))
    }
  }

  if ((context.scope === 'process' || context.scope === 'scenario') && context.processName) {
    processes = processes.filter((p) => p.name === context.processName)
  }
  if (context.scope === 'module' && context.moduleName) {
    const modules = ir.modules?.filter((m) => m.name === context.moduleName)
    if (modules?.length) {
      return {
        ...ir,
        moduleName: modules[0]!.name,
        modules,
        types: modules[0]!.types,
        variables: modules[0]!.variables,
        processes: modules[0]!.processes,
        invariants: modules[0]!.invariants
      }
    }
  }

  const ids = context.selectedNodeIds
  if (ids?.length) {
    const set = new Set(ids)
    types = types.filter((t) => idHit(set, t.informalId, t.id, `type-${t.name}`))
    variables = variables.filter((v) => idHit(set, v.informalId, `var-${v.name}`))
    invariants = invariants.filter((inv) => idHit(set, inv.informalId, inv.id, `inv-${inv.name}`))
    const anyProc = processes.some((p) => idHit(set, p.informalId, p.id, `proc-${p.name}`))
    processes = processes
      .map((p) => {
        const keepProcess = idHit(set, p.informalId, p.id, `proc-${p.name}`)
        const scenarios = (p.scenarios ?? []).filter((s) => idHit(set, s.id, `${p.name}-${s.name}`))
        if (keepProcess) return p
        if (!anyProc && scenarios.length) {
          const post = scenarioPost(scenarios)
          return { ...p, scenarios, post, postconditions: [post] }
        }
        return null
      })
      .filter((p): p is HybridProcessIR => p !== null)
  }

  return { ...ir, types, variables, processes, invariants }
}

export function irToGenerationResult(
  spec: InformalSpecification,
  ir: HybridSpecificationIR,
  context: GenerationContext = {}
): HybridGenerationResult {
  const filtered = filterHybridIR(ir, context)
  const document = hybridIRToAspec(spec, filtered)
  const source = serializeInformalSpec(spec)
  const partial =
    Boolean(context.selectedNodeIds?.length) ||
    (context.scope !== undefined && context.scope !== 'hybrid')
  const refined = refineToAsfl(document, source, {
    preserveExisting: partial && Boolean(context.existingAsfl?.trim()),
    existingAsfl: context.existingAsfl
  })
  const traceLinks: SpecTraceLink[] = []
  for (const proc of filtered.processes) {
    if (!proc.informalId) continue
    traceLinks.push({
      id: `tr-${proc.informalId}-${proc.name}`,
      sourceId: proc.informalId,
      targetId: proc.name,
      relation: 'refines',
      confidence: 0.7
    })
  }
  for (const t of filtered.types) {
    if (!t.informalId) continue
    traceLinks.push({
      id: `tr-${t.informalId}-${t.name}`,
      sourceId: t.informalId,
      targetId: t.name,
      relation: 'derives-from',
      confidence: 0.7
    })
  }
  for (const inv of filtered.invariants) {
    if (!inv.informalId) continue
    traceLinks.push({
      id: `tr-${inv.informalId}-${inv.name}`,
      sourceId: inv.informalId,
      targetId: inv.name,
      relation: 'constrains',
      confidence: 0.7
    })
  }
  return {
    specification: filtered,
    asflText: refined.asflText,
    traceLinks,
    warnings: refined.warnings.map((w) => ({ code: w.code, message: w.message })),
    changes: changeItems(ir)
  }
}
