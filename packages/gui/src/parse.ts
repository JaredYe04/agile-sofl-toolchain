import { parse as parseYaml } from 'yaml'
import type { GuiDocument, GuiSection } from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'
import type { GuiDiagnostic } from './model.js'

export interface ParseResult {
  document: GuiDocument | null
  diagnostics: GuiDiagnostic[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeGuiSection(raw: unknown): GuiSection | null {
  if (!isRecord(raw) || !isRecord(raw.app) || !Array.isArray(raw.screens)) return null
  return raw as unknown as GuiSection
}

function normalizeGuispec(raw: unknown): GuiDocument | null {
  if (!isRecord(raw)) return null
  const guispecVersion = String(raw.guispecVersion ?? '1.0')
  if (!isRecord(raw.meta) || !raw.gui) return null
  const gui = normalizeGuiSection(raw.gui)
  if (!gui) return null
  return {
    guispecVersion,
    meta: raw.meta as unknown as GuiDocument['meta'],
    gui
  }
}

export function parseGuiSpec(source: string): ParseResult {
  const diagnostics: GuiDiagnostic[] = []
  try {
    const raw = parseYaml(source)
    const document = normalizeGuispec(raw)
    if (!document) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.SCHEMA_ERROR,
          'Invalid guispec structure: requires guispecVersion, meta, gui',
          'error'
        )
      )
      return { document: null, diagnostics }
    }
    return { document, diagnostics }
  } catch (e) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.PARSE_ERROR,
        e instanceof Error ? e.message : String(e),
        'error'
      )
    )
    return { document: null, diagnostics }
  }
}

export function parseGuiFromAspecYaml(source: string): { gui: GuiSection | null; meta?: GuiDocument['meta'] } {
  try {
    const raw = parseYaml(source)
    if (!isRecord(raw)) return { gui: null }
    const gui = raw.gui ? normalizeGuiSection(raw.gui) : null
    const meta = isRecord(raw.meta) ? (raw.meta as unknown as GuiDocument['meta']) : undefined
    return { gui, meta }
  } catch {
    return { gui: null }
  }
}
