import { createHash } from 'node:crypto'
import type { AspecDocument, InformalDocumentModel } from './model.js'
import { parseAspec } from './parse.js'
import { validateAspec } from './validate.js'
import { resolveModuleParents } from './resolveParents.js'
import { extractGuiFromAspec } from '@agile-sofl/gui'
import type { GuiModelSummary } from './model.js'
import { attachDiagnosticLines } from './sourceSpans.js'
import { aspecToInformal } from './informal/bridge.js'
import { validateInformalSpec } from './informal/validator.js'

export type BuildInformalModelOptions = {
  bookAlignStrict?: boolean
}

export function buildInformalModel(source: string, options?: BuildInformalModelOptions): InformalDocumentModel {
  const parsed = parseAspec(source)
  const { document, diagnostics: parseDiags } = parsed
  if (!document) {
    return {
      meta: { id: '', title: 'Invalid' },
      system: { name: '', purpose: '' },
      modules: [],
      diagnostics: attachDiagnosticLines(source, parseDiags)
    }
  }
  resolveModuleParents(document)
  const styleDiags = validateAspec(document, { bookAlignStrict: options?.bookAlignStrict })
  const informal = parsed.informal ?? aspecToInformal(document)
  const informalDiags = validateInformalSpec(informal)
  let guiSummary: GuiModelSummary | undefined
  if (parsed.format !== 'markdown') {
    const embeddedGui = extractGuiFromAspec(source)
    if (embeddedGui || document.meta.guiTarget) {
      guiSummary = {
        appName: embeddedGui?.app?.name ?? '',
        screenCount: embeddedGui?.screens?.length ?? 0,
        flowCount: embeddedGui?.flows?.length ?? 0,
        embedded: Boolean(embeddedGui),
        externalPath: document.meta.guiTarget
      }
    }
  } else if (document.meta.guiTarget) {
    guiSummary = {
      appName: '',
      screenCount: 0,
      flowCount: 0,
      embedded: false,
      externalPath: document.meta.guiTarget
    }
  }
  return {
    meta: document.meta,
    system: document.system,
    modules: document.modules,
    bookAlign: document.bookAlign,
    gui: guiSummary,
    format: parsed.format,
    informal,
    diagnostics: attachDiagnosticLines(source, [...parseDiags, ...styleDiags, ...informalDiags])
  }
}

export function contentHash(source: string): string {
  return 'sha256:' + createHash('sha256').update(source, 'utf8').digest('hex')
}

export function buildInformalModelFromDocument(document: AspecDocument): InformalDocumentModel {
  resolveModuleParents(document)
  return {
    meta: document.meta,
    system: document.system,
    modules: document.modules,
    diagnostics: validateAspec(document)
  }
}
