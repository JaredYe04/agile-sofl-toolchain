import { createHash } from 'node:crypto'
import type { AspecDocument, InformalDocumentModel } from './model.js'
import { parseAspec } from './parse.js'
import { validateAspec } from './validate.js'
import { resolveModuleParents } from './resolveParents.js'
import { attachDiagnosticLines } from './sourceSpans.js'

export function buildInformalModel(source: string): InformalDocumentModel {
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
  const styleDiags = validateAspec(document)
  return {
    meta: document.meta,
    system: document.system,
    modules: document.modules,
    bookAlign: document.bookAlign,
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
