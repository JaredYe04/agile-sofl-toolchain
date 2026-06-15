import { ipcMain } from 'electron'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ProjectIndex, walk, textOf } from '@agile-sofl/parser'
import {
  buildModuleGraphLayout,
  buildVisualModelTolerant,
  patchFsfSpec,
  patchComment,
  patchDecom,
  patchInvariant,
  patchDeclaration,
  patchProcess,
  patchFunction,
  patchExt,
  patchProcessSignature,
  patchFunctionSignature,
  patchAlias,
  patchProcessInit,
  patchModule,
  formatDocument,
  findProcess,
  parsePredicateUi,
  uiToPredicateText,
  validateProcessSignature,
  validateFunctionSignature,
  type FsfScenarioDto,
  type ExtVarDto,
  type DeclarationKind
} from '@agile-sofl/editor-api'
import { cloneForIpc } from './ipcClone.js'

function collectAsflFiles(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...collectAsflFiles(full))
    else if (entry.endsWith('.asfl')) out.push(full)
  }
  return out
}

function moduleLabel(mod: { name: string; isSystem: boolean }): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

function toSerializableSpan(span: { start: number; end: number; line: number; column: number }) {
  return { start: span.start, end: span.end, line: span.line, column: span.column }
}

export function registerParseHandlers(): void {
  ipcMain.handle('studio:build-visual-model', (_event, source: string, _channelId: string) => {
    const result = buildVisualModelTolerant(source)
    return cloneForIpc({
      parseFailed: result.parseFailed,
      hasDiagnostics: result.hasDiagnostics,
      documentModel: result.ast ? { modules: result.modules } : null,
      diagnostics: result.diagnostics,
      moduleGraph: result.moduleGraph,
      fsfModels: result.fsfModels,
      modules: result.modules
    })
  })

  ipcMain.handle('studio:reset-visual-channel', () => {
    /* tolerant build is stateless per request */
  })

  ipcMain.handle(
    'studio:build-module-graph-layout',
    (
      _event,
      graph: Parameters<typeof buildModuleGraphLayout>[0],
      options?: Parameters<typeof buildModuleGraphLayout>[1]
    ) => cloneForIpc(buildModuleGraphLayout(cloneForIpc(graph), options ?? {}))
  )

  ipcMain.handle('studio:format-document', (_event, source: string) => {
    return formatDocument(source)
  })

  ipcMain.handle(
    'studio:patch-document',
    (
      _event,
      payload: {
        source: string
        kind: 'fsf' | 'comment' | 'decom'
        processName: string
        scenarios?: FsfScenarioDto[]
        others?: string
        text?: string
      }
    ) => {
      const { source, kind, processName } = payload
      switch (kind) {
        case 'fsf':
          return patchFsfSpec(source, processName, payload.scenarios ?? [], payload.others)
        case 'comment':
          return patchComment(source, processName, payload.text ?? '')
        case 'decom':
          return patchDecom(source, processName, payload.text ?? '')
        default:
          return source
      }
    }
  )

  ipcMain.handle(
    'studio:patch-declaration',
    (
      _event,
      payload: {
        source: string
        moduleName: string
        kind: DeclarationKind
        action: 'patch' | 'add' | 'remove'
        name?: string
        text?: string
      }
    ) => patchDeclaration(payload.source, payload)
  )

  ipcMain.handle(
    'studio:patch-process',
    (
      _event,
      payload: {
        source: string
        moduleName: string
        kind: 'process' | 'function'
        action: 'add' | 'remove' | 'rename'
        name: string
        newName?: string
        template?: string
      }
    ) => patchProcess(payload.source, payload)
  )

  ipcMain.handle(
    'studio:patch-function',
    (
      _event,
      payload: {
        source: string
        moduleName: string
        name: string
        body?: string
        fsf?: { scenarios: FsfScenarioDto[]; others?: string }
      }
    ) => patchFunction(payload.source, payload)
  )

  ipcMain.handle('studio:find-process-has-fsf', (_event, source: string, processName: string) => {
    const { ast } = buildVisualModelTolerant(source)
    if (!ast) return false
    const proc = findProcess(ast, processName)
    return Boolean(proc?.body?.fsf)
  })

  ipcMain.handle(
    'studio:patch-invariant',
    (
      _event,
      payload: { source: string; span: { start: number; end: number }; text: string }
    ) => patchInvariant(payload.source, payload.span, payload.text)
  )

  ipcMain.handle('studio:parse-predicate-ui', (_event, text: string) =>
    cloneForIpc(parsePredicateUi(text))
  )

  ipcMain.handle('studio:ui-to-predicate-text', (_event, node: Parameters<typeof uiToPredicateText>[0]) =>
    uiToPredicateText(node)
  )

  ipcMain.handle(
    'studio:validate-signature',
    (_event, kind: 'process' | 'function', signature: string) =>
      cloneForIpc(
        kind === 'process'
          ? validateProcessSignature(signature)
          : validateFunctionSignature(signature)
      )
  )

  ipcMain.handle(
    'studio:patch-ext',
    (
      _event,
      payload: { source: string; moduleName: string; processName: string; vars: ExtVarDto[] }
    ) => patchExt(payload.source, payload.moduleName, payload.processName, payload.vars)
  )

  ipcMain.handle(
    'studio:patch-process-signature',
    (
      _event,
      payload: { source: string; moduleName: string; processName: string; signature: string }
    ) => patchProcessSignature(payload.source, payload.moduleName, payload.processName, payload.signature)
  )

  ipcMain.handle(
    'studio:patch-function-signature',
    (
      _event,
      payload: { source: string; moduleName: string; functionName: string; signature: string }
    ) =>
      patchFunctionSignature(
        payload.source,
        payload.moduleName,
        payload.functionName,
        payload.signature
      )
  )

  ipcMain.handle(
    'studio:patch-alias',
    (
      _event,
      payload: { source: string; moduleName: string; processName: string; aliasTarget: string }
    ) => patchAlias(payload.source, payload.moduleName, payload.processName, payload.aliasTarget)
  )

  ipcMain.handle(
    'studio:patch-process-init',
    (
      _event,
      payload: {
        source: string
        moduleName: string
        processName: string
        isInit: boolean
        fallbackName?: string
      }
    ) =>
      patchProcessInit(
        payload.source,
        payload.moduleName,
        payload.processName,
        payload.isInit,
        payload.fallbackName
      )
  )

  ipcMain.handle(
    'studio:patch-module',
    (
      _event,
      payload: {
        source: string
        action: 'add' | 'remove' | 'rename'
        moduleName: string
        newName?: string
        parentName?: string
        isSystem?: boolean
      }
    ) => patchModule(payload.source, payload)
  )

  ipcMain.handle('studio:search-workspace-files', (_event, rootDir: string, query?: string) => {
    if (!rootDir || !existsSync(rootDir)) return []
    const needle = query?.trim().toLowerCase() ?? ''
    const files = collectAsflFiles(rootDir)
      .filter((path) => !needle || path.toLowerCase().includes(needle))
      .slice(0, 50)
    return cloneForIpc(files.map((path) => ({ path })))
  })

  ipcMain.handle('studio:search-workspace-symbols', (_event, rootDir: string, query?: string) => {
    if (!rootDir || !existsSync(rootDir)) return []
    const index = new ProjectIndex()
    index.scan(rootDir, (p) => pathToFileURL(p.replace(/\\/g, '/')).href)

    const needle = query?.trim().toLowerCase() ?? ''
    const results: Array<{
      uri: string
      name: string
      kind: string
      moduleName: string
      span: ReturnType<typeof toSerializableSpan>
      containerName?: string
    }> = []

    for (const sym of index.symbols(query)) {
      results.push({
        uri: sym.uri,
        name: sym.name,
        kind: sym.kind,
        moduleName: sym.moduleName,
        span: toSerializableSpan(sym.span),
        containerName: sym.containerName
      })
    }

    for (const doc of index.documents()) {
      if (!doc.ast || doc.ast.type !== 'program') continue
      walk(doc.ast, {
        enterModule(mod) {
          const label = moduleLabel(mod)
          for (const inv of mod.invariants) {
            const text = textOf(inv.condition).trim()
            const name = text.length > 48 ? text.slice(0, 47) + '…' : text || 'invariant'
            if (needle && !name.toLowerCase().includes(needle)) continue
            results.push({
              uri: doc.uri,
              name,
              kind: 'invariant',
              moduleName: mod.name,
              span: toSerializableSpan(inv.span),
              containerName: label
            })
          }
          for (const proc of mod.processes) {
            const fsf = proc.body?.fsf
            if (!fsf) continue
            const fsfName = `FSF (${proc.name})`
            if (!needle || fsfName.toLowerCase().includes(needle) || proc.name.toLowerCase().includes(needle)) {
              results.push({
                uri: doc.uri,
                name: fsfName,
                kind: 'fsf',
                moduleName: mod.name,
                span: toSerializableSpan(fsf.span),
                containerName: label
              })
            }
            fsf.scenarios.forEach((scenario, i) => {
              const test = textOf(scenario.test).trim()
              const name = test.length > 40 ? test.slice(0, 39) + '…' : test || `Scenario ${i + 1}`
              if (needle && !name.toLowerCase().includes(needle) && !proc.name.toLowerCase().includes(needle)) {
                return
              }
              results.push({
                uri: doc.uri,
                name: `${proc.name}: ${name}`,
                kind: 'fsf',
                moduleName: mod.name,
                span: toSerializableSpan(scenario.span),
                containerName: label
              })
            })
          }
        }
      })
    }

    return cloneForIpc(results)
  })
}
