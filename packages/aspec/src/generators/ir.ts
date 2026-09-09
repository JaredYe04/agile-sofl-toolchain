import { toIdent, toSnakeIdent } from '../informal/ids.js'
import type { InformalNode, InformalSpecification } from '../informal/model.js'
import type {
  HybridGenerationResult,
  HybridProcessIR,
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
        typeHint: 'string',
        description: f.description
      }))
    })
    variables.push({
      name: toSnakeIdent(resource.title),
      typeHint: fields.length ? typeName : 'string',
      informalId: resource.id
    })
  }

  const processes: HybridProcessIR[] = []
  const walk = (node: InformalNode) => {
    const children = nested(node)
    const isStructural =
      /^(input|output|result|precondition|postcondition)s?$/i.test(node.title.trim())
    if (!isStructural) {
      processes.push({
        name: toIdent(node.title),
        informalId: node.id,
        description: node.description,
        inputs: [],
        outputs: [],
        preconditions: [],
        postconditions: [],
        children: children
          .filter((c) => !/^(input|output|result)/i.test(c.title))
          .map((c) => toIdent(c.title))
      })
    }
    for (const child of children) walk(child)
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
  const processes: InformalProcess[] = ir.processes.map((p) => ({
    id: p.informalId ?? `proc-${p.name}`,
    name: p.name,
    description: p.description,
    signature: {
      inputs: p.inputs.map((i) => ({ name: i.name, typeHint: i.typeHint })),
      outputs: p.outputs.map((o) => ({ name: o.name, typeHint: o.typeHint }))
    },
    scenarios: [
      ...p.preconditions.map((pre, i) => ({
        id: `${p.informalId ?? p.name}-pre-${i}`,
        condition: pre,
        outcome: p.postconditions[0] ?? 'true'
      })),
      ...(p.preconditions.length
        ? []
        : p.postconditions.map((post, i) => ({
            id: `${p.informalId ?? p.name}-post-${i}`,
            condition: 'others',
            outcome: post
          })))
    ],
    decomposition: p.children?.length ? `${p.name}_Decom` : undefined
  }))

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
    modules: [
      {
        id: `mod-${spec.moduleId}`,
        name: ir.moduleName,
        description: spec.metadata.title ?? ir.moduleName,
        types: ir.types.map((t) => ({
          id: t.informalId ?? `type-${t.name}`,
          name: t.name,
          typeHint: t.fields.length
            ? `composed of ${t.fields.map((f) => `${f.name}: ${f.typeHint}`).join(' ')} end`
            : 'string',
          description: t.fields.map((f) => f.description).filter(Boolean).join('; ')
        })),
        variables: ir.variables.map((v) => ({
          id: v.informalId ?? `var-${v.name}`,
          name: v.name,
          typeHint: v.typeHint
        })),
        invariants: ir.invariants.map((inv) => ({
          id: inv.informalId ?? `inv-${inv.name}`,
          description: inv.name,
          textHint: 'true'
        })),
        processes
      }
    ]
  }
}

export function irToGenerationResult(
  spec: InformalSpecification,
  ir: HybridSpecificationIR
): HybridGenerationResult {
  const document = hybridIRToAspec(spec, ir)
  const source = serializeInformalSpec(spec)
  const refined = refineToAsfl(document, source)
  const traceLinks: SpecTraceLink[] = []
  for (const proc of ir.processes) {
    if (!proc.informalId) continue
    traceLinks.push({
      id: `tr-${proc.informalId}-${proc.name}`,
      sourceId: proc.informalId,
      targetId: proc.name,
      relation: 'refines',
      confidence: 0.7
    })
  }
  for (const t of ir.types) {
    if (!t.informalId) continue
    traceLinks.push({
      id: `tr-${t.informalId}-${t.name}`,
      sourceId: t.informalId,
      targetId: t.name,
      relation: 'derives-from',
      confidence: 0.7
    })
  }
  for (const inv of ir.invariants) {
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
    specification: ir,
    asflText: refined.asflText,
    traceLinks,
    warnings: refined.warnings.map((w) => ({ code: w.code, message: w.message }))
  }
}
