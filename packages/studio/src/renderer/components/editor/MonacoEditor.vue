<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, shallowRef, computed } from 'vue'
import type * as Monaco from 'monaco-editor'
import { monaco, initMonacoBase } from '../../monaco/setup'
import { registerLanguageConfiguration, registerTextMateTokens } from '../../monaco/textmate'
import { uriForTab } from '../../monaco/languageClient'
import { buildMinimapOptions } from '../../monaco/minimapOptions'
import { registerAgileSoflFormatProvider } from '../../monaco/formatProvider'
import { EDIT_COMMAND_IDS } from '../../composables/editCommands'
import { useDocumentStore } from '../../stores/document'
import { useDocumentHistoryStore } from '../../stores/documentHistory'
import { useLspStore } from '../../stores/lsp'
import { useLspDiagnosticsStore } from '../../stores/lspDiagnostics'
import type { DiagnosticSummary, HybridRegionPayload } from '../../../preload/index'
import { useEditorUiStore } from '../../stores/editorUi'

export type SerializableSpan = {
  start: number
  end: number
  line: number
  column: number
}

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
const models = new Map<string, Monaco.editor.ITextModel>()
let markerSub: Monaco.IDisposable | null = null
let highlightDecorations: string[] = []
let highlightClearTimer: ReturnType<typeof setTimeout> | null = null
let suppressHistory = false

const doc = useDocumentStore()
const history = useDocumentHistoryStore()
const lsp = useLspStore()
const lspDiagnostics = useLspDiagnosticsStore()
const editorUi = useEditorUiStore()

const activeDocumentTab = computed(() =>
  doc.activeTab?.kind === 'document' ? doc.activeTab : null
)

function runCommand(cmd: string): void {
  const ed = editor.value
  if (!ed) return
  ed.focus()
  const actionId = EDIT_COMMAND_IDS[cmd] ?? cmd
  void ed.getAction(actionId)?.run()
}

defineExpose({
  runEditCommand: runCommand,
  async formatDocument() {
    const { formatEditorInstance } = await import('../../composables/useFormatDocument')
    return formatEditorInstance(editor.value)
  },
  applyContent(content: string, fromHistory = false): void {
    const tab = activeDocumentTab.value
    const ed = editor.value
    if (!tab || !ed) return
    suppressHistory = true
    doc.setContent(tab.id, content, tab.isDirty)
    const language = tab.documentKind === 'aspec' ? 'agile-aspec' : 'agile-sofl'
    const model = getOrCreateModel(tab.id, tab.uri, content, language)
    if (ed.getModel()?.uri.toString() !== model.uri.toString()) {
      ed.setModel(model)
    }
    if (model.getValue() !== content) {
      model.setValue(content)
    }
    model.pushStackElement()
    model.pushEditOperations([], [], () => null)
    if (fromHistory) {
      history.applyExternalContent(tab.id, content)
    }
    suppressHistory = false
  },
  revealSpan(span: SerializableSpan): void {
    const ed = editor.value
    const model = ed?.getModel()
    if (!ed || !model) return
    const start = model.getPositionAt(span.start)
    const end = model.getPositionAt(span.end)
    ed.revealRangeInCenter(
      new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column)
    )
    ed.setSelection(
      new monaco.Selection(
        start.lineNumber,
        start.column,
        end.lineNumber,
        end.column
      )
    )
    highlightDecorations = ed.deltaDecorations(highlightDecorations, [
      {
        range: new monaco.Range(start.lineNumber, 1, end.lineNumber, 1),
        options: {
          isWholeLine: true,
          className: 'studio-code-highlight-line',
          overviewRuler: {
            color: 'rgba(55, 148, 255, 0.6)',
            position: monaco.editor.OverviewRulerLane.Center
          }
        }
      }
    ])
    if (highlightClearTimer) clearTimeout(highlightClearTimer)
    highlightClearTimer = setTimeout(() => {
      highlightDecorations = ed.deltaDecorations(highlightDecorations, [])
      highlightClearTimer = null
    }, 2000)
  }
})

function getOrCreateModel(tabId: string, uri: string, content: string, language: string): Monaco.editor.ITextModel {
  let model = models.get(tabId)
  if (model) {
    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language)
    }
    return model
  }
  model = monaco.editor.createModel(content, language, uriForTab(uri))
  models.set(tabId, model)
  history.initTab(tabId, content)
  return model
}

function applyEditorOptions(): void {
  editor.value?.updateOptions({
    minimap: buildMinimapOptions(editorUi.showMinimap),
    lineNumbers: editorUi.showLineNumbers ? 'on' : 'off'
  })
}

let hybridDecorations: string[] = []
let hybridTimer: ReturnType<typeof setTimeout> | null = null

const HYBRID_CLASS: Record<string, string> = {
  fsf: 'studio-hybrid-fsf',
  informal: 'studio-hybrid-informal',
  comment: 'studio-hybrid-comment',
  decom: 'studio-hybrid-decom'
}

async function refreshHybridDecorations(): Promise<void> {
  const tab = activeDocumentTab.value
  const ed = editor.value
  const model = ed?.getModel()
  if (!tab || !ed || !model || tab.documentKind !== 'asfl' || !window.studio?.buildHybridRegions) {
    hybridDecorations = ed?.deltaDecorations(hybridDecorations, []) ?? []
    return
  }
  const regions = await window.studio.buildHybridRegions(tab.content)
  hybridDecorations = ed.deltaDecorations(
    hybridDecorations,
    regions.map((r: HybridRegionPayload) => ({
      range: new monaco.Range(
        model.getPositionAt(r.span.start).lineNumber,
        1,
        model.getPositionAt(Math.max(r.span.end - 1, r.span.start)).lineNumber,
        1
      ),
      options: {
        isWholeLine: true,
        className: HYBRID_CLASS[r.type] ?? 'studio-hybrid-fsf'
      }
    }))
  )
}

function scheduleHybridDecorations(): void {
  if (hybridTimer) clearTimeout(hybridTimer)
  hybridTimer = setTimeout(() => void refreshHybridDecorations(), 300)
}

function syncModel(): void {
  const tab = activeDocumentTab.value
  const ed = editor.value
  if (!tab || !ed) return
  const language = tab.documentKind === 'aspec' ? 'agile-aspec' : 'agile-sofl'
  const model = getOrCreateModel(tab.id, tab.uri, tab.content, language)
  if (ed.getModel()?.uri.toString() !== model.uri.toString()) {
    ed.setModel(model)
  }
  scheduleHybridDecorations()
}

function markerSeverityLabel(severity: Monaco.MarkerSeverity): string {
  if (severity === monaco.MarkerSeverity.Error) return 'error'
  if (severity === monaco.MarkerSeverity.Warning) return 'warning'
  if (severity === monaco.MarkerSeverity.Info) return 'info'
  return 'info'
}

function markersToDiagnostics(
  model: Monaco.editor.ITextModel,
  markers: Monaco.editor.IMarker[]
): DiagnosticSummary[] {
  return markers.map((m) => ({
    code: m.code?.toString() ?? 'LSP',
    message: m.message,
    severity: markerSeverityLabel(m.severity),
    source: 'lsp' as const,
    span: {
      start: model.getOffsetAt({ lineNumber: m.startLineNumber, column: m.startColumn }),
      end: model.getOffsetAt({ lineNumber: m.endLineNumber, column: m.endColumn }),
      line: m.startLineNumber,
      column: m.startColumn
    }
  }))
}

function updateMarkerDiagnostics(): void {
  const tab = activeDocumentTab.value
  const ed = editor.value
  if (!tab || !ed || tab.documentKind === 'aspec') {
    lspDiagnostics.clear()
    lsp.setErrorCount(0)
    return
  }
  const model = ed.getModel()
  if (!model) {
    lspDiagnostics.clear()
    lsp.setErrorCount(0)
    return
  }
  const uri = uriForTab(tab.uri)
  const markers = monaco.editor.getModelMarkers({ resource: uri })
  const items = markersToDiagnostics(model, markers)
  lspDiagnostics.setMarkers(items)
  lsp.setErrorCount(items.filter((d) => d.severity === 'error').length)
}

function onContentChange(): void {
  const tab = activeDocumentTab.value
  const ed = editor.value
  if (!tab || !ed || suppressHistory) return
  const value = ed.getValue()
  if (value !== tab.content) {
    history.pushSnapshot(tab.id, value)
    doc.updateContent(tab.id, value)
    scheduleHybridDecorations()
  }
}

onMounted(async () => {
  initMonacoBase()
  registerAgileSoflFormatProvider()
  try {
    await registerTextMateTokens()
    await registerLanguageConfiguration()
  } catch (err) {
    console.error('[studio] TextMate setup failed:', err)
  }

  const isDark = document.documentElement.classList.contains('dark')
  if (container.value) {
    editor.value = monaco.editor.create(container.value, {
      theme: isDark ? 'agile-sofl-dark' : 'agile-sofl-light',
      automaticLayout: true,
      fontSize: 14,
      minimap: buildMinimapOptions(editorUi.showMinimap),
      lineNumbers: editorUi.showLineNumbers ? 'on' : 'off',
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      tabSize: 4
    })
    editor.value.onDidChangeModelContent(onContentChange)
    syncModel()
  }

  await lsp.refresh()
  if (lsp.running) await lsp.ensureClient()
  else {
    const unsub = window.studio?.lspOnStatusChanged(async (s: { running: boolean; message?: string }) => {
      if (s.running) {
        await lsp.ensureClient()
        unsub?.()
      }
    })
  }

  markerSub = monaco.editor.onDidChangeMarkers(() => updateMarkerDiagnostics())
})

watch(() => doc.activeTabId, () => {
  syncModel()
  updateMarkerDiagnostics()
  highlightDecorations = editor.value?.deltaDecorations(highlightDecorations, []) ?? []
})

watch(
  () => doc.documentTabs.map((t) => `${t.id}:${t.content.length}:${t.uri}`).join('|'),
  () => {
    for (const tab of doc.documentTabs) {
      const model = models.get(tab.id)
      if (model && model.getValue() !== tab.content) {
        suppressHistory = true
        model.setValue(tab.content)
        model.pushStackElement()
        history.applyExternalContent(tab.id, tab.content)
        suppressHistory = false
      }
    }
  }
)

watch([() => editorUi.showMinimap, () => editorUi.showLineNumbers], applyEditorOptions)

onUnmounted(() => {
  markerSub?.dispose()
  editor.value?.dispose()
  for (const m of models.values()) m.dispose()
  models.clear()
})
</script>

<template>
  <div ref="container" class="h-full min-h-0 flex-1" />
</template>

<style>
.monaco-editor .studio-code-highlight-line {
  background: rgba(55, 148, 255, 0.12);
}
.monaco-editor .studio-hybrid-fsf {
  border-left: 3px solid rgba(0, 120, 212, 0.5);
}
.monaco-editor .studio-hybrid-informal {
  background: rgba(206, 145, 120, 0.15);
}
.monaco-editor .studio-hybrid-comment {
  background: rgba(106, 153, 85, 0.12);
}
.monaco-editor .studio-hybrid-decom {
  background: rgba(204, 167, 0, 0.12);
}
</style>
