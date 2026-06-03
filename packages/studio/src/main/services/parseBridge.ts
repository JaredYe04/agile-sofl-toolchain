import { ipcMain } from 'electron'
import {
  buildDocumentModel,
  buildModuleGraph,
  buildAllFsfModels,
  checkIncremental,
  patchFsfSpec,
  patchComment,
  patchDecom,
  findProcess,
  sliceText,
  type IncrementalCheckState,
  type FsfScenarioDto
} from '@agile-sofl/editor-api'

const incrementalByChannel = new Map<string, IncrementalCheckState>()

export function registerParseHandlers(): void {
  ipcMain.handle('studio:build-visual-model', (_event, source: string, channelId: string) => {
    const prev = channelId ? incrementalByChannel.get(channelId) : undefined
    const result = checkIncremental(source, prev)
    if (channelId) incrementalByChannel.set(channelId, result.state)

    const parseFailed = !result.ast || result.diagnostics.some((d) => d.severity === 'error')
    const documentModel = result.ast
      ? buildDocumentModel(result.ast, source)
      : buildDocumentModel(source)

    return {
      parseFailed,
      documentModel,
      moduleGraph: result.ast ? buildModuleGraph(result.ast) : null,
      fsfModels: result.ast ? buildAllFsfModels(result.ast, source) : [],
      modules: result.ast
        ? result.ast.modules.map((mod) => ({
            name: mod.name,
            isSystem: mod.isSystem,
            parentName: mod.parent?.name,
            constCount: mod.consts.length,
            typeCount: mod.types.length,
            varCount: mod.vars.length,
            invCount: mod.invariants.length,
            processes: mod.processes.map((p) => ({
              name: p.name,
              decom: p.body?.decomposition?.span
                ? sliceText(source, p.body.decomposition.span)
                : '',
              comment: p.body?.comment?.span ? sliceText(source, p.body.comment.span) : '',
              hasFsf: Boolean(p.body?.fsf)
            })),
            functions: mod.functions.map((f) => f.name),
            consts: mod.consts.map((c) => c.name),
            types: mod.types.map((t) => t.name),
            vars: mod.vars.map((v) => v.variable.name)
          }))
        : []
    }
  })

  ipcMain.handle('studio:reset-visual-channel', (_event, channelId: string) => {
    incrementalByChannel.delete(channelId)
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

  ipcMain.handle('studio:find-process-has-fsf', (_event, source: string, processName: string) => {
    const { ast } = checkIncremental(source)
    if (!ast) return false
    const proc = findProcess(ast, processName)
    return Boolean(proc?.body?.fsf)
  })
}
