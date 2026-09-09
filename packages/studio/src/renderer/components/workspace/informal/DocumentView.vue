<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { useDocumentStore } from '../../../stores/document'
import { useHistoryStore } from '../../../stores/history'
import { HistoryKinds } from '../../../history/kinds'
import { useAppStore } from '../../../stores/app'

type InformalSection = 'functions' | 'data-resources' | 'constraints'

const props = defineProps<{ tabId?: string }>()
const emit = defineEmits<{ add: [section: InformalSection] }>()
const { t, locale } = useI18n()
const doc = useDocumentStore()
const history = useHistoryStore()
const app = useAppStore()
const host = ref<HTMLElement | null>(null)
const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
let editor: Vditor | null = null
let applyingExternal = false

const tab = computed(() => {
  if (!props.tabId) return null
  const found = doc.tabs.find((t) => t.id === props.tabId)
  return found?.kind === 'document' ? found : null
})

function vditorCdn(): string {
  return new URL('vditor', window.location.href).href.replace(/\/?$/, '')
}

function syncTheme(): void {
  isDark.value = document.documentElement.classList.contains('dark')
  editor?.setTheme(isDark.value ? 'dark' : 'classic', isDark.value ? 'dark' : 'light')
}

function onChange(value: string): void {
  const current = tab.value
  if (!current || applyingExternal || history.applying) return
  if (value === current.content) return
  history.applyDocument(current.id, value, {
    kind: HistoryKinds.informalEdit,
    coalesceKey: 'informal-md',
    immediate: false
  })
}

function toolbarItem(section: InformalSection, label: string) {
  return {
    name: `add-${section}`,
    tip: label,
    tipPosition: 's' as const,
    className: 'informal-vd-tool',
    icon: `<span class="informal-vd-btn">+ ${label}</span>`,
    click() {
      emit('add', section)
    }
  }
}

function mountEditor(): void {
  if (!host.value || !tab.value) return
  editor?.destroy()
  editor = null
  const start = tab.value.content
  editor = new Vditor(host.value, {
    cdn: vditorCdn(),
    mode: 'wysiwyg',
    height: '100%',
    lang: locale.value === 'zh-CN' ? 'zh_CN' : 'en_US',
    theme: isDark.value ? 'dark' : 'classic',
    icon: 'material',
    cache: { enable: false },
    counter: { enable: false },
    outline: { enable: false },
    resize: { enable: false },
    placeholder: '# Functions',
    toolbar: [
      toolbarItem('functions', t('informal.function')),
      toolbarItem('data-resources', t('informal.data')),
      toolbarItem('constraints', t('informal.constraint'))
    ],
    preview: {
      mode: 'editor',
      actions: [],
      markdown: { toc: false, mark: true },
      theme: { current: isDark.value ? 'dark' : 'light' }
    },
    after: () => {
      applyingExternal = true
      editor?.setValue(start, true)
      applyingExternal = false
    },
    input: (value: string) => onChange(value)
  })
}

function revealSpan(span: { start: number; end: number; line: number; column: number }): void {
  const root = host.value
  if (!root) return
  const lineIndex = Math.max(0, span.line - 1)
  const blocks = root.querySelectorAll(
    '.vditor-wysiwyg h1, .vditor-wysiwyg h2, .vditor-wysiwyg h3, .vditor-wysiwyg h4, .vditor-reset h1, .vditor-reset h2'
  )
  const target = (blocks[Math.min(lineIndex, Math.max(0, blocks.length - 1))] as HTMLElement | undefined) ?? null
  if (!target) return
  target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  target.classList.add('informal-md-flash')
  window.setTimeout(() => target.classList.remove('informal-md-flash'), 1800)
}

watch(
  () => tab.value?.id,
  async () => {
    await nextTick()
    mountEditor()
  }
)

watch(
  () => tab.value?.content,
  (content) => {
    if (content == null || !editor) return
    if (content === editor.getValue()) return
    applyingExternal = true
    editor.setValue(content, true)
    applyingExternal = false
  }
)

watch(() => app.theme, syncTheme)
watch(locale, () => void mountEditor())

onMounted(() => {
  syncTheme()
  mountEditor()
  const observer = new MutationObserver(syncTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onUnmounted(() => {
    observer.disconnect()
    editor?.destroy()
    editor = null
  })
})

defineExpose({ revealSpan })
</script>

<template>
  <div v-if="tabId && tab" class="informal-md-shell h-full min-h-0 min-w-0">
    <div ref="host" class="informal-vditor h-full min-h-0" />
  </div>
  <p v-else class="p-4 text-xs text-content-muted">{{ $t('workspace.noInformal') }}</p>
</template>

<style scoped>
.informal-md-shell {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--gui-canvas);
}

.informal-vditor {
  min-height: 0;
  flex: 1;
}

.informal-md-shell :deep(.vditor) {
  height: 100%;
  border: none;
  background: var(--gui-canvas);
}

.informal-md-shell :deep(.vditor-toolbar) {
  border-bottom: 1px solid var(--gui-hairline);
  background: var(--gui-canvas-soft);
  padding: 2px 6px;
}

.informal-md-shell :deep(.informal-vd-tool) {
  padding: 0 2px !important;
  width: auto !important;
}

.informal-md-shell :deep(.informal-vd-tool .vditor-tooltipped) {
  height: auto;
  width: auto !important;
  line-height: 1;
  padding: 0;
}

.informal-md-shell :deep(.informal-vd-btn) {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-family: inherit;
  color: var(--text-secondary);
  white-space: nowrap;
}

.informal-md-shell :deep(.informal-vd-tool:hover .informal-vd-btn) {
  background: var(--surface-overlay);
  color: var(--text-primary);
}

.informal-md-shell :deep(.vditor-content),
.informal-md-shell :deep(.vditor-wysiwyg),
.informal-md-shell :deep(.vditor-reset) {
  background: var(--gui-canvas);
  color: var(--gui-ink);
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Source Serif 4', serif;
  font-size: 15px;
  line-height: 1.7;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.informal-md-shell :deep(.vditor-content::-webkit-scrollbar),
.informal-md-shell :deep(.vditor-wysiwyg::-webkit-scrollbar),
.informal-md-shell :deep(.vditor-reset::-webkit-scrollbar) {
  width: var(--scrollbar-size);
  height: var(--scrollbar-size);
}

.informal-md-shell :deep(.vditor-content::-webkit-scrollbar-track),
.informal-md-shell :deep(.vditor-wysiwyg::-webkit-scrollbar-track),
.informal-md-shell :deep(.vditor-reset::-webkit-scrollbar-track) {
  background: var(--scrollbar-track);
  border-radius: 999px;
}

.informal-md-shell :deep(.vditor-content::-webkit-scrollbar-thumb),
.informal-md-shell :deep(.vditor-wysiwyg::-webkit-scrollbar-thumb),
.informal-md-shell :deep(.vditor-reset::-webkit-scrollbar-thumb) {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
  border: 1px solid transparent;
  background-clip: padding-box;
}

.informal-md-shell :deep(.vditor-content::-webkit-scrollbar-thumb:hover),
.informal-md-shell :deep(.vditor-wysiwyg::-webkit-scrollbar-thumb:hover),
.informal-md-shell :deep(.vditor-reset::-webkit-scrollbar-thumb:hover) {
  background: var(--scrollbar-thumb-hover);
  background-clip: padding-box;
}

.informal-md-shell :deep(.vditor-outline),
.informal-md-shell :deep(.vditor-counter),
.informal-md-shell :deep(.vditor-resize) {
  display: none;
}

.informal-md-shell :deep(.informal-vd-tool .vditor-tooltipped::after),
.informal-md-shell :deep(.informal-vd-tool .vditor-tooltipped::before) {
  display: none !important;
}

.informal-md-shell :deep(.informal-md-flash) {
  background: color-mix(in srgb, var(--text-primary) 10%, transparent);
  transition: background 1.4s ease;
}
</style>
