/**
 * Workspace-level index of Agile-SOFL documents for cross-file symbols and definition.
 */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ProgramNode, ModuleNode } from '../ast/nodes.js'
import type { Span } from '../ast/span.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { parse } from '../parser/parse.js'
import { resolveScope } from '../scope/resolver.js'
import type { ScopeResult, SymbolKind } from '../scope/resolver.js'
import {
  resolveDeclarationAtOffset,
  resolveReference,
  resolveReferenceByName,
  type ReferenceTarget
} from '../scope/reference.js'

export interface ProjectDocument {
  uri: string
  source: string
  mtimeMs: number
  contentHash: string
  ast: ProgramNode | null
  diagnostics: Diagnostic[]
  scope: ScopeResult | null
}

export interface ProjectSymbol {
  uri: string
  name: string
  kind: SymbolKind | 'module'
  moduleName: string
  span: Span
  containerName?: string
}

export interface DefinitionLocation {
  uri: string
  target: ReferenceTarget
}

function indexDocument(source: string): { ast: ProgramNode | null; diagnostics: Diagnostic[]; scope: ScopeResult | null } {
  const { ast, diagnostics } = parse(source)
  if (!ast || ast.type !== 'program') {
    return { ast: null, diagnostics, scope: null }
  }
  if (diagnostics.some((d) => d.severity === 'error' && d.code === 'ASFL_PARSE_001')) {
    return { ast: null, diagnostics, scope: null }
  }
  const scopeResult = resolveScope(ast)
  return {
    ast,
    diagnostics: [...diagnostics, ...scopeResult.diagnostics],
    scope: scopeResult
  }
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function collectAsflFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...collectAsflFiles(full))
    else if (entry.endsWith('.asfl')) out.push(full)
  }
  return out
}

function moduleLabel(mod: ModuleNode): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

export class ProjectIndex {
  private readonly docs = new Map<string, ProjectDocument>()
  private readonly moduleUri = new Map<string, string>()

  upsert(uri: string, source: string, mtimeMs = Date.now()): ProjectDocument {
    const contentHash = hashText(source)
    const existing = this.docs.get(uri)
    if (existing && existing.contentHash === contentHash) return existing

    if (existing?.ast) {
      for (const mod of existing.ast.modules) {
        if (this.moduleUri.get(mod.name) === uri) this.moduleUri.delete(mod.name)
      }
    }

    const { ast, diagnostics, scope } = indexDocument(source)
    const doc: ProjectDocument = { uri, source, mtimeMs, contentHash, ast, diagnostics, scope }
    this.docs.set(uri, doc)
    if (ast) {
      for (const mod of ast.modules) {
        this.moduleUri.set(mod.name, uri)
      }
    }
    return doc
  }

  remove(uri: string): void {
    const doc = this.docs.get(uri)
    if (doc?.ast) {
      for (const mod of doc.ast.modules) {
        if (this.moduleUri.get(mod.name) === uri) this.moduleUri.delete(mod.name)
      }
    }
    this.docs.delete(uri)
  }

  scan(rootDir: string, toUri: (path: string) => string = (p) => pathToFileURL(p).href): void {
    for (const filePath of collectAsflFiles(rootDir)) {
      const st = statSync(filePath)
      this.upsert(toUri(filePath), readFileSync(filePath, 'utf-8'), st.mtimeMs)
    }
  }

  get(uri: string): ProjectDocument | undefined {
    return this.docs.get(uri)
  }

  documents(): ProjectDocument[] {
    return [...this.docs.values()]
  }

  mergedProgram(): ProgramNode | null {
    const modules: ModuleNode[] = []
    for (const doc of this.docs.values()) {
      if (doc.ast?.modules.length) modules.push(...doc.ast.modules)
    }
    if (modules.length === 0) return null
    const span = modules[0].span
    return { type: 'program', span, modules }
  }

  mergedScope(): ScopeResult | null {
    const program = this.mergedProgram()
    return program ? resolveScope(program) : null
  }

  uriForModule(moduleName: string): string | undefined {
    return this.moduleUri.get(moduleName)
  }

  findDefinition(uri: string, offset: number): DefinitionLocation | null {
    const doc = this.docs.get(uri)
    if (!doc?.ast || doc.ast.type !== 'program') return null

    const scope = this.mergedScope() ?? doc.scope
    if (!scope) return null

    const target =
      resolveReference(doc.ast, scope, offset) ?? resolveDeclarationAtOffset(doc.ast, scope, offset)
    if (!target || target.span.end <= target.span.start) return null

    const targetUri = this.moduleUri.get(target.module.name) ?? uri
    return { uri: targetUri, target }
  }

  findDefinitionByName(
    uri: string,
    name: string,
    moduleQualifier?: string,
    offset?: number
  ): DefinitionLocation | null {
    const doc = this.docs.get(uri)
    if (!doc?.ast || doc.ast.type !== 'program') return null
    const scope = this.mergedScope() ?? doc.scope
    if (!scope) return null

    const currentMod =
      doc.ast.modules.find(
        (m) => offset !== undefined && offset >= m.span.start && offset <= m.span.end
      ) ?? doc.ast.modules[0]
    if (!currentMod) return null

    const target = resolveReferenceByName(scope, currentMod, name, moduleQualifier, offset)
    if (!target) return null
    const targetUri = this.moduleUri.get(target.module.name) ?? uri
    return { uri: targetUri, target }
  }

  symbols(query?: string): ProjectSymbol[] {
    const needle = query?.trim().toLowerCase() ?? ''
    const out: ProjectSymbol[] = []

    for (const doc of this.docs.values()) {
      if (!doc.ast) continue
      for (const mod of doc.ast.modules) {
        const label = moduleLabel(mod)
        if (!needle || label.toLowerCase().includes(needle)) {
          out.push({
            uri: doc.uri,
            name: label,
            kind: 'module',
            moduleName: mod.name,
            span: mod.span
          })
        }
        const entries: Array<{ kind: SymbolKind; name: string; span: Span }> = [
          ...mod.consts.map((c) => ({ kind: 'const' as const, name: c.name, span: c.span })),
          ...mod.types.map((t) => ({ kind: 'type' as const, name: t.name, span: t.span })),
          ...mod.vars.map((v) => ({
            kind: 'var' as const,
            name: v.variable.name,
            span: v.variable.span
          })),
          ...mod.processes.map((p) => ({ kind: 'process' as const, name: p.name, span: p.span })),
          ...mod.functions.map((f) => ({ kind: 'function' as const, name: f.name, span: f.span }))
        ]
        for (const sym of entries) {
          if (needle && !sym.name.toLowerCase().includes(needle)) continue
          out.push({
            uri: doc.uri,
            name: sym.name,
            kind: sym.kind,
            moduleName: mod.name,
            span: sym.span,
            containerName: label
          })
        }
      }
    }
    return out
  }
}

export function createProjectIndex(): ProjectIndex {
  return new ProjectIndex()
}
