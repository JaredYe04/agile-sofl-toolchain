<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef, computed } from 'vue'
import { monaco, initMonacoBase } from '../../../../monaco/setup'
import { fieldThemeName } from '../../../../monaco/themes'
import { registerLanguageConfiguration, registerTextMateTokens } from '../../../../monaco/textmate'
import type { SymbolHint } from '../predicate/predicateTypes'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    rows?: number
    symbols?: SymbolHint[]
    bordered?: boolean
  }>(),
  { bordered: true, rows: 2 }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<ReturnType<typeof monaco.editor.create> | null>(null)
let completionProvider: ReturnType<typeof monaco.languages.registerCompletionItemProvider> | null = null
let fieldId = 0
let modelUri: ReturnType<typeof monaco.Uri.parse> | null = null

const LINE_H = 19

const containerClass = computed(() => {
  const base = 'code-field w-full overflow-hidden'
  if (props.bordered) return `${base} visual-field`
  return base
})

function lineHeight(): number {
  return props.rows * LINE_H + 12
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

function applyFieldTheme(): void {
  monaco.editor.setTheme(fieldThemeName(isDarkMode()))
}

function registerSymbols(): void {
  completionProvider?.dispose()
  completionProvider = null
  if (!props.symbols?.length) return
  completionProvider = monaco.languages.registerCompletionItemProvider('agile-sofl', {
    triggerCharacters: ['.', '_'],
    provideCompletionItems: (doc, pos) => {
      const word = doc.getWordUntilPosition(pos)
      const range = {
        startLineNumber: pos.lineNumber,
        endLineNumber: pos.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }
      const prefix = word.word.toLowerCase()
      const suggestions = (props.symbols ?? [])
        .filter((s) => !prefix || s.label.toLowerCase().startsWith(prefix))
        .slice(0, 30)
        .map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: s.label,
          detail: s.kind,
          range
        }))
      return { suggestions }
    }
  })
}

let themeObserver: MutationObserver | null = null

onMounted(async () => {
  initMonacoBase()
  await registerLanguageConfiguration()
  await registerTextMateTokens()
  fieldId += 1
  modelUri = monaco.Uri.parse(`inmemory://predicate/field-${fieldId}-${Date.now()}`)
  const model = monaco.editor.createModel(props.modelValue, 'agile-sofl', modelUri)
  if (container.value) container.value.style.height = `${lineHeight()}px`
  applyFieldTheme()
  editor.value = monaco.editor.create(container.value!, {
    model,
    theme: fieldThemeName(isDarkMode()),
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: 'off',
    folding: false,
    glyphMargin: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    scrollbar: { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 6 },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    renderLineHighlight: props.bordered ? 'line' : 'none',
    contextmenu: true,
    readOnly: props.disabled,
    fontSize: 13,
    padding: { top: 4, bottom: 4 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: true
  })
  editor.value.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.value!.getValue())
  })
  registerSymbols()

  themeObserver = new MutationObserver(() => {
    applyFieldTheme()
    editor.value?.updateOptions({ theme: fieldThemeName(isDarkMode()) })
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(
  () => props.modelValue,
  (v) => {
    const ed = editor.value
    const m = ed?.getModel()
    if (m && m.getValue() !== v) m.setValue(v)
  }
)

watch(
  () => props.disabled,
  (d) => editor.value?.updateOptions({ readOnly: d })
)

watch(
  () => props.rows,
  () => {
    if (container.value) container.value.style.height = `${lineHeight()}px`
    editor.value?.layout()
  }
)

watch(
  () => props.symbols,
  () => registerSymbols(),
  { deep: true }
)

onUnmounted(() => {
  themeObserver?.disconnect()
  completionProvider?.dispose()
  editor.value?.dispose()
  if (modelUri) monaco.editor.getModel(modelUri)?.dispose()
})
</script>

<template>
  <div ref="container" :class="containerClass" />
</template>

<style scoped>
.code-field :deep(.monaco-editor),
.code-field :deep(.overflow-guard) {
  width: 100% !important;
  height: 100% !important;
}

.code-field :deep(.monaco-editor) {
  outline: none;
}
</style>
