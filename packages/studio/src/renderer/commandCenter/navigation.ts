import { nextTick } from 'vue'
import type { SerializableSpan } from '../../preload/index'
import type { CommandCenterContext } from './types'
import { fileUriToPath } from './types'
import { useDocumentStore } from '../stores/document'
import { useEditorSelectionStore } from '../stores/editorSelection'
import { filePathsEqual } from '../stores/tabUtils'

export async function activateUri(uri: string): Promise<void> {
  const doc = useDocumentStore()
  const path = fileUriToPath(uri)
  if (path) {
    const existing = doc.documentTabs.find((t) => t.filePath && filePathsEqual(t.filePath, path))
    if (existing) {
      doc.setActive(existing.id)
      return
    }
    const result = await window.studio!.fileRead(path)
    doc.openFromFile(result.filePath, result.content, result.title)
    return
  }
  const tab = doc.documentTabs.find((t) => t.uri === uri)
  if (tab) doc.setActive(tab.id)
}

export async function navigateToLocation(
  ctx: CommandCenterContext,
  uri: string,
  span: SerializableSpan,
  symbolMeta?: {
    kind: string
    moduleName: string
    name: string
  }
): Promise<void> {
  await activateUri(uri)
  await nextTick()
  ctx.revealSpan(span)

  if (!symbolMeta) return
  const selection = useEditorSelectionStore()
  const { kind, moduleName, name } = symbolMeta
  if (kind === 'module') {
    selection.setSelection({ kind: 'module', moduleName })
  } else if (kind === 'process') {
    selection.setSelection({ kind: 'process', moduleName, processName: name })
  } else if (kind === 'function') {
    selection.setSelection({ kind: 'function', moduleName, functionName: name })
  }
}

export function lspRangeToSpan(
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
): SerializableSpan {
  return {
    start: 0,
    end: 0,
    line: range.start.line + 1,
    column: range.start.character + 1
  }
}

export function symbolKindLabel(kind: string, t: CommandCenterContext['t']): string {
  const map: Record<string, string> = {
    module: 'commandCenter.symbol.module',
    const: 'commandCenter.symbol.const',
    type: 'commandCenter.symbol.type',
    var: 'commandCenter.symbol.var',
    process: 'commandCenter.symbol.process',
    function: 'commandCenter.symbol.function',
    invariant: 'commandCenter.symbol.invariant',
    fsf: 'commandCenter.symbol.fsf'
  }
  const key = map[kind]
  return key ? t(key) : kind
}
