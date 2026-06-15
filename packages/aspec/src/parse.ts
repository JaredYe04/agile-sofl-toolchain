import { parse as parseYaml } from 'yaml'
import type { AspecDocument } from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'
import type { AspecDiagnostic } from './model.js'

export interface ParseResult {
  document: AspecDocument | null
  diagnostics: AspecDiagnostic[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeDocument(raw: unknown): AspecDocument | null {
  if (!isRecord(raw)) return null
  const aspecVersion = String(raw.aspecVersion ?? '1.0')
  if (!isRecord(raw.meta) || !isRecord(raw.system) || !Array.isArray(raw.modules)) {
    return null
  }
  const meta = raw.meta as unknown as AspecDocument['meta']
  const system = raw.system as unknown as AspecDocument['system']
  const modules = raw.modules as unknown as AspecDocument['modules']
  return {
    aspecVersion,
    meta,
    system,
    modules,
    bookAlign: isRecord(raw.bookAlign) ? raw.bookAlign : undefined
  }
}

export function parseAspec(source: string): ParseResult {
  const diagnostics: AspecDiagnostic[] = []
  try {
    const raw = parseYaml(source)
    const document = normalizeDocument(raw)
    if (!document) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.SCHEMA_ERROR,
          'Invalid aspec structure: requires aspecVersion, meta, system, modules',
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
