<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { monaco, initMonacoBase } from '../../../monaco/setup'
import { fieldThemeName } from '../../../monaco/themes'

const props = defineProps<{
  modelValue: string
  fileName?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<ReturnType<typeof monaco.editor.create> | null>(null)
let modelUri: ReturnType<typeof monaco.Uri.parse> | null = null
let themeObserver: MutationObserver | null = null

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}

onMounted(() => {
  initMonacoBase()
  modelUri = monaco.Uri.parse(`inmemory://gui-screen/${encodeURIComponent(props.fileName || 'screen')}-${Date.now()}.html`)
  const model = monaco.editor.createModel(props.modelValue, 'html', modelUri)
  monaco.editor.setTheme(fieldThemeName(isDarkMode()))
  editor.value = monaco.editor.create(container.value!, {
    model,
    theme: fieldThemeName(isDarkMode()),
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    fontSize: 13,
    tabSize: 2,
    padding: { top: 8, bottom: 8 }
  })
  editor.value.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.value!.getValue())
  })
  themeObserver = new MutationObserver(() => {
    monaco.editor.setTheme(fieldThemeName(isDarkMode()))
  })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

watch(
  () => props.modelValue,
  (v) => {
    const model = editor.value?.getModel()
    if (model && model.getValue() !== v) model.setValue(v)
  }
)

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  editor.value?.dispose()
  if (modelUri) monaco.editor.getModel(modelUri)?.dispose()
})
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <header
      v-if="fileName"
      class="flex h-8 shrink-0 items-center border-b border-border-subtle px-3 font-mono text-[11px] text-content-secondary"
    >
      {{ fileName }}
    </header>
    <div ref="container" class="min-h-0 min-w-0 flex-1" />
  </div>
</template>
