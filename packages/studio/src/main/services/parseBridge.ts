import { ipcMain } from 'electron'
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
}
