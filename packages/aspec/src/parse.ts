import { parse as parseYaml } from 'yaml'
import type { AspecDocument } from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'
import type { AspecDiagnostic } from './model.js'
import { detectAspecFormat, applyInformalMeta, type InformalMeta } from './informal/format.js'
import { parseInformalSpec } from './informal/parser.js'
import { informalToAspec } from './informal/bridge.js'
import type { InformalSpecification } from './informal/model.js'

export interface ParseResult {
  document: AspecDocument | null
  diagnostics: AspecDiagnostic[]
  format?: 'yaml' | 'markdown'
  informal?: InformalSpecification | null
}

export type ParseAspecOptions = {
  meta?: InformalMeta
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

function parseYamlAspec(source: string): ParseResult {
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
      return { document: null, diagnostics, format: 'yaml', informal: null }
    }
    return { document, diagnostics, format: 'yaml' }
  } catch (e) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.PARSE_ERROR,
        e instanceof Error ? e.message : String(e),
        'error'
      )
    )
    return { document: null, diagnostics, format: 'yaml', informal: null }
  }
}

export function parseAspec(source: string, options?: ParseAspecOptions): ParseResult {
  if (detectAspecFormat(source) === 'markdown') {
    const parsed = parseInformalSpec(source, options)
    if (!parsed.specification) {
      return { document: null, diagnostics: parsed.diagnostics, format: 'markdown', informal: null }
    }
    if (options?.meta) applyInformalMeta(parsed.specification, options.meta)
    return {
      document: informalToAspec(parsed.specification),
      diagnostics: parsed.diagnostics,
      format: 'markdown',
      informal: parsed.specification
    }
  }
  const yaml = parseYamlAspec(source)
  return yaml
}
