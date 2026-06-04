import { ipcMain } from 'electron'
import {
  buildVisualModelTolerant,
  patchFsfSpec,
  patchComment,
  patchDecom,
  patchDeclaration,
  patchProcess,
  formatDocument,
  findProcess,
  type FsfScenarioDto,
  type DeclarationKind
} from '@agile-sofl/editor-api'

export function registerParseHandlers(): void {
  ipcMain.handle('studio:build-visual-model', (_event, source: string, _channelId: string) => {
    const result = buildVisualModelTolerant(source)
    return {
      parseFailed: result.parseFailed,
      hasDiagnostics: result.hasDiagnostics,
      documentModel: result.ast ? { modules: result.modules } : null,
      diagnostics: result.diagnostics,
      moduleGraph: result.moduleGraph,
      fsfModels: result.fsfModels,
      modules: result.modules
    }
  })

  ipcMain.handle('studio:reset-visual-channel', () => {
    /* tolerant build is stateless per request */
  })

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

  ipcMain.handle('studio:find-process-has-fsf', (_event, source: string, processName: string) => {
    const { ast } = buildVisualModelTolerant(source)
    if (!ast) return false
    const proc = findProcess(ast, processName)
    return Boolean(proc?.body?.fsf)
  })
}
