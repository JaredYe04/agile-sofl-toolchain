import type {
  GuiDocumentModel,
  InformalProcessRef,
  InformalVariableRef
} from './model.js'
import { parseGuiSpec } from './parse.js'
import { validateGuiSpec } from './validate.js'
import {
  extractGuiFromAspec,
  guispecFromGuiSection,
  mergeGuiSources
} from './patch.js'
import { parseGuiFromAspecYaml } from './parse.js'
import { serializeGuiSpec } from './serialize.js'

export function collectProcessRefs(modules: Array<{
  id: string
  processes?: Array<{ id: string; name: string }>
}>): InformalProcessRef[] {
  const refs: InformalProcessRef[] = []
  for (const mod of modules) {
    for (const proc of mod.processes ?? []) {
      refs.push({ id: proc.id, name: proc.name, moduleId: mod.id })
    }
  }
  return refs
}

export function collectVariableRefs(modules: Array<{
  id: string
  variables?: Array<{ id: string; name: string }>
}>): InformalVariableRef[] {
  const refs: InformalVariableRef[] = []
  for (const mod of modules) {
    for (const v of mod.variables ?? []) {
      refs.push({ id: v.id, name: v.name, moduleId: mod.id })
    }
  }
  return refs
}

export function buildGuiModel(
  source: string,
  options?: {
    informalModules?: Array<{
      id: string
      processes?: Array<{ id: string; name: string }>
      variables?: Array<{ id: string; name: string }>
    }>
    sourceKind?: 'guispec' | 'aspec-embedded'
  }
): GuiDocumentModel {
  const processRefs = options?.informalModules
    ? collectProcessRefs(options.informalModules)
    : undefined
  const variableRefs = options?.informalModules
    ? collectVariableRefs(options.informalModules)
    : undefined

  const { document, diagnostics: parseDiags } = parseGuiSpec(source)
  if (!document) {
    return {
      meta: { id: '', title: 'Invalid' },
      app: { name: '' },
      screens: [],
      flows: [],
      diagnostics: parseDiags,
      sourceKind: options?.sourceKind ?? 'guispec'
    }
  }

  const styleDiags = validateGuiSpec(document, { processRefs, variableRefs })

  return {
    meta: document.meta,
    app: document.gui.app,
    screens: document.gui.screens.map((s) => ({
      ...s,
      widgetCount: s.widgets?.length ?? 0
    })),
    flows: document.gui.flows ?? [],
    diagnostics: [...parseDiags, ...styleDiags],
    sourceKind: options?.sourceKind ?? 'guispec'
  }
}

export function buildGuiModelFromAspec(
  aspecSource: string,
  externalGuiSource?: string | null,
  informalModules?: Array<{
    id: string
    processes?: Array<{ id: string; name: string }>
    variables?: Array<{ id: string; name: string }>
  }>
): GuiDocumentModel {
  const embedded = extractGuiFromAspec(aspecSource)
  let externalGui = null as ReturnType<typeof extractGuiFromAspec>
  if (externalGuiSource) {
    const parsed = parseGuiSpec(externalGuiSource)
    externalGui = parsed.document?.gui ?? null
  }
  const merged = mergeGuiSources(embedded, externalGui)
  if (!merged) {
    const { meta } = parseGuiFromAspecYaml(aspecSource)
    return {
      meta: meta ?? { id: '', title: 'No GUI' },
      app: { name: '' },
      screens: [],
      flows: [],
      diagnostics: [],
      sourceKind: 'aspec-embedded'
    }
  }

  const { meta } = parseGuiFromAspecYaml(aspecSource)
  const doc = guispecFromGuiSection(merged, {
    id: meta?.id ?? 'embedded-gui',
    title: meta?.title ? `${meta.title} GUI` : 'Embedded GUI',
    informalTarget: undefined
  })
  return buildGuiModel(serializeGuiSpec(doc), {
    informalModules,
    sourceKind: 'aspec-embedded'
  })
}

export function buildGuiModelTolerant(
  source: string,
  options?: Parameters<typeof buildGuiModel>[1]
): GuiDocumentModel {
  return buildGuiModel(source, options)
}
