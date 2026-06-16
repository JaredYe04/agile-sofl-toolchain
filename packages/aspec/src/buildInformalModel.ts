import { createHash } from 'node:crypto'
import type { AspecDocument, InformalDocumentModel } from './model.js'
import { parseAspec } from './parse.js'
import { validateAspec } from './validate.js'
import { resolveModuleParents } from './resolveParents.js'
import { extractGuiFromAspec } from '@agile-sofl/gui'
import type { GuiModelSummary } from './model.js'
import { attachDiagnosticLines } from './sourceSpans.js'

export type BuildInformalModelOptions = {
  bookAlignStrict?: boolean
}

export function buildInformalModel(source: string, options?: BuildInformalModelOptions): InformalDocumentModel {
  const { document, diagnostics: parseDiags } = parseAspec(source)
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
  const embeddedGui = extractGuiFromAspec(source)
  let guiSummary: GuiModelSummary | undefined
  if (embeddedGui || document.meta.guiTarget) {
    guiSummary = {
      appName: embeddedGui?.app?.name ?? '',
      screenCount: embeddedGui?.screens?.length ?? 0,
      flowCount: embeddedGui?.flows?.length ?? 0,
      embedded: Boolean(embeddedGui),
      externalPath: document.meta.guiTarget
    }
  }
  return {
    meta: document.meta,
    system: document.system,
    modules: document.modules,
    bookAlign: document.bookAlign,
    gui: guiSummary,
    diagnostics: attachDiagnosticLines(source, [...parseDiags, ...styleDiags])
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
