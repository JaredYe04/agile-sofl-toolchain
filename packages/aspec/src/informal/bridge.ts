import type {
  AspecDocument,
  BookAlignSection,
  InformalInv,
  InformalModule,
  InformalProcess,
  InformalType,
  InformalVar
} from '../model.js'
import { createNodeId, createSpecId, toIdent, toSnakeIdent } from './ids.js'
import {
  emptyInformalSpecification,
  type InformalNode,
  type InformalSpecification,
  type InformalTreeNode
} from './model.js'

function nested(node: InformalNode): InformalNode[] {
  return (node.metadata?.nested as InformalNode[] | undefined) ?? []
}

export function informalToAspec(spec: InformalSpecification): AspecDocument {
  const title = spec.metadata.title || 'Informal Specification'
  const fromModule =
    spec.moduleId && spec.moduleId !== 'project' ? toIdent(spec.moduleId.replace(/^SYSTEM_/i, '')) : ''
  const fromTitle =
    toIdent(title)
      .replace(/InformalSpecification$/i, '')
      .replace(/InformalSpec$/i, '') || 'System'
  const systemName = fromModule || fromTitle
  const moduleName = systemName.startsWith('SYSTEM_') ? systemName : `SYSTEM_${systemName}`
  const functions = spec.sections.find((s) => s.type === 'functions')?.children ?? []
  const data = spec.sections.find((s) => s.type === 'data-resources')?.children ?? []
  const constraints = spec.sections.find((s) => s.type === 'constraints')?.children ?? []

  const types: InformalType[] = []
  const variables: InformalVar[] = []
  for (const resource of data) {
    const fields = nested(resource)
    const typeName = toIdent(resource.title)
    if (fields.length) {
      types.push({
        id: `type-${resource.id}`,
        name: typeName,
        typeHint: composedTypeHint(fields) || 'string',
        description: resource.description
      })
    }
    variables.push({
      id: `var-${resource.id}`,
      name: toSnakeIdent(resource.title),
      typeHint: fields.length ? typeName : 'string',
      description: resource.description
    })
  }

  const processes: InformalProcess[] = []
  const walkFn = (node: InformalNode, parentName?: string) => {
    const children = nested(node)
    processes.push({
      id: node.id,
      name: toIdent(node.title),
      description: node.description,
      decomposition: children.length ? children.map((c) => toIdent(c.title)).join(', ') : parentName,
      notes: node.description
    })
    for (const child of children) walkFn(child, toIdent(node.title))
  }
  for (const fn of functions) walkFn(fn)

  const invariants: InformalInv[] = constraints.map((c) => ({
    id: c.id,
    description: c.title,
    textHint: c.description?.trim() || c.title
  }))

  const bookAlign: BookAlignSection = {
    functions: functions.map((f, i) => ({
      ref: `F_${i + 1}`,
      description: [f.title, f.description].filter(Boolean).join(' — ')
    })),
    data: data.map((d, i) => ({
      ref: `D_${i + 1}`,
      description: [d.title, d.description].filter(Boolean).join(' — '),
      usedBy: functions.map((_, fi) => `F_${fi + 1}`)
    })),
    constraints: constraints.map((c, i) => ({
      ref: `C_${i + 1}`,
      description: [c.title, c.description].filter(Boolean).join(' — '),
      refs: functions.map((_, fi) => `F_${fi + 1}`)
    }))
  }

  const mod: InformalModule = {
    id: `mod-${spec.moduleId}`,
    name: moduleName,
    description: title,
    types,
    variables,
    invariants,
    processes
  }

  return {
    aspecVersion: '1.0',
    meta: {
      id: spec.id,
      title,
      hybridTarget: spec.metadata.hybridTarget,
      guiTarget: spec.metadata.guiTarget
    },
    system: {
      name: systemName,
      purpose: title
    },
    modules: [mod],
    bookAlign
  }
}

function composedTypeHint(fields: InformalNode[]): string {
  const inner = fields.map((f) => `${toSnakeIdent(f.title)}: string`).join(' ')
  return inner ? `composed of ${inner} end` : 'string'
}

export function aspecToInformal(document: AspecDocument): InformalSpecification {
  const used = new Set<string>()
  const spec = emptyInformalSpecification({
    id: document.meta.id || createSpecId(),
    moduleId: document.system.name || 'project',
    metadata: {
      title: document.meta.title,
      author: document.meta.author,
      hybridTarget: document.meta.hybridTarget,
      guiTarget: document.meta.guiTarget,
      sourceFormat: 'yaml'
    }
  })

  const fnSection = spec.sections.find((s) => s.type === 'functions')!
  const drSection = spec.sections.find((s) => s.type === 'data-resources')!
  const cSection = spec.sections.find((s) => s.type === 'constraints')!

  if (document.bookAlign?.functions?.length) {
    fnSection.children = document.bookAlign.functions.map((item) =>
      leaf('function', item.description, used)
    )
  } else {
    for (const mod of document.modules) {
      for (const proc of mod.processes ?? []) {
        fnSection.children.push(
          leaf('function', proc.name, used, proc.description ?? proc.notes)
        )
      }
    }
  }

  if (document.bookAlign?.data?.length) {
    drSection.children = document.bookAlign.data.map((item) =>
      leaf('data-resource', item.description, used)
    )
  } else {
    for (const mod of document.modules) {
      for (const t of mod.types ?? []) {
        drSection.children.push(leaf('data-resource', t.name, used, t.description))
      }
      for (const v of mod.variables ?? []) {
        if (!drSection.children.some((c) => c.title === v.name)) {
          drSection.children.push(leaf('data-resource', v.name, used, v.description))
        }
      }
    }
  }

  if (document.bookAlign?.constraints?.length) {
    cSection.children = document.bookAlign.constraints.map((item) =>
      leaf('constraint', item.description, used)
    )
  } else {
    for (const mod of document.modules) {
      for (const inv of mod.invariants ?? []) {
        cSection.children.push(
          leaf('constraint', inv.description || inv.textHint || 'Invariant', used, inv.textHint)
        )
      }
    }
  }

  return spec
}

function leaf(
  type: InformalTreeNode['type'],
  title: string,
  used: Set<string>,
  description?: string
): InformalNode {
  const short = title.split(/[—–-]/)[0]!.trim() || title
  const id = createNodeId(type, short, used)
  return {
    id,
    type,
    title: short,
    description: description ?? (short === title ? undefined : title),
    children: []
  }
}
