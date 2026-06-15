<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useDocumentHistoryStore } from '../../stores/documentHistory'
import { useModalStore } from '../../stores/modal'
import type { InformalSpanPayload, SerializableSpan } from '../../preload/index'

const emit = defineEmits<{ revealSpan: [span: SerializableSpan] }>()

const { t } = useI18n()
const doc = useDocumentStore()
const history = useDocumentHistoryStore()
const modal = useModalStore()
const spans = ref<InformalSpanPayload[]>([])
const open = ref(false)

function fieldLabel(field: InformalSpanPayload['field']): string {
  if (field === 'fsf') return t('informal.fsfRegion')
  return field
}

async function refresh(): Promise<void> {
  const tab = doc.activeTab
  if (!tab || tab.documentKind !== 'asfl' || !window.studio?.getInformalSpans) {
    spans.value = []
    return
  }
  spans.value = await window.studio.getInformalSpans(tab.content)
}

watch(() => doc.activeTab?.content, () => void refresh(), { immediate: true })
watch(() => doc.activeTabId, () => void refresh())

onMounted(() => void refresh())

async function editSpan(span: InformalSpanPayload): Promise<void> {
  const tab = doc.activeTab
  if (!tab || !window.studio?.patchInformal) return
  const result = await modal.show({
    title: t('informal.editRegion'),
    message: t('informal.editRegionHint', { process: span.processName, field: span.field }),
    buttons: [t('newFile.cancel'), t('dialog.ok')],
    input: true,
    inputValue: span.text
  })
  if (result.index !== 1) return
  const value = result.value ?? span.text
  const patched = await window.studio.patchInformal({
    source: tab.content,
    span: span.span,
    text: value
  })
  doc.setContent(tab.id, patched)
  history.pushSnapshot(tab.id, patched)
  await refresh()
}
</script>

<template>
  <div v-if="spans.length" class="border-t border-border-subtle bg-surface-raised">
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay"
      @click="open = !open"
    >
      <span>{{ t('informal.regionsTitle', { count: spans.length }) }}</span>
      <span>{{ open ? '▼' : '▶' }}</span>
    </button>
    <ul v-if="open" class="max-h-32 overflow-y-auto studio-scroll px-3 pb-2">
      <li v-for="(s, i) in spans" :key="i">
        <button
          type="button"
          class="w-full truncate py-0.5 text-left text-xs text-accent hover:underline"
          @click="emit('revealSpan', s.span)"
          @dblclick.prevent="editSpan(s)"
        >
          {{ s.processName }} ({{ fieldLabel(s.field) }}): {{ s.text.slice(0, 60) }}
        </button>
      </li>
    </ul>
  </div>
</template>
