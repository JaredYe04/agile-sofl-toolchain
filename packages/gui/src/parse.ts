import type { GuiDocument, GuiMeta, GuiSection } from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'
import type { GuiDiagnostic } from './model.js'
import { emptyGuiHtml, GUI_HTML_VERSION, looksLikeYamlGui } from './dialect.js'
import { parseHtmlFragment, sanitizeHtml } from './html.js'
import { tryParseYamlGui } from './migrate.js'
import { sectionFromRoot } from './project.js'

export interface ParseResult {
  document: GuiDocument | null
  diagnostics: GuiDiagnostic[]
}

function defaultMeta(title = 'GUI'): GuiMeta {
  return { id: 'gui', title }
}

export function parseGuiSpec(source: string): ParseResult {
  const diagnostics: GuiDiagnostic[] = []
  const trimmed = source.trim()
  if (!trimmed) {
    const html = emptyGuiHtml()
    return {
      document: {
        guispecVersion: GUI_HTML_VERSION,
        meta: defaultMeta(),
        html,
        gui: sectionFromRoot(parseHtmlFragment(html))
      },
      diagnostics
    }
  }

  let html = source
  let meta = defaultMeta()
  if (looksLikeYamlGui(source)) {
    const migrated = tryParseYamlGui(source)
    if (!migrated) {
      diagnostics.push(
        createDiagnostic(DiagnosticCodes.PARSE_ERROR, 'Invalid YAML GUI spec; expected guispecVersion + gui', 'error')
      )
      return { document: null, diagnostics }
    }
    html = migrated.html
    meta = migrated.meta
  }

  const sanitized = sanitizeHtml(html)
  if (!sanitized.trim()) {
    diagnostics.push(createDiagnostic(DiagnosticCodes.PARSE_ERROR, 'GUI HTML is empty after sanitizing', 'error'))
    return { document: null, diagnostics }
  }
  const root = parseHtmlFragment(sanitized)
  const gui = sectionFromRoot(root)
  return {
    document: {
      guispecVersion: GUI_HTML_VERSION,
      meta,
      html: sanitized,
      gui
    },
    diagnostics
  }
}

export function parseGuiFromAspecYaml(source: string): { gui: GuiSection | null; meta?: GuiMeta } {
  const migrated = tryParseYamlGui(source.includes('gui:') ? source : `gui:\n${source}`)
  if (migrated) {
    return { gui: sectionFromRoot(parseHtmlFragment(migrated.html)), meta: migrated.meta }
  }
  return { gui: null }
}
