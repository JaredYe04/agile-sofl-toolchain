<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useEditorUiStore, type GraphTool } from '../../../stores/editorUi'

const { t } = useI18n()
const editorUi = useEditorUiStore()

const tools: { id: GraphTool; labelKey: string }[] = [
  { id: 'select', labelKey: 'visual.graphTool.select' },
  { id: 'pan', labelKey: 'visual.graphTool.pan' }
]

function setTool(id: GraphTool): void {
  editorUi.setGraphTool(id)
}
</script>

<template>
  <div
    class="pointer-events-auto absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-raised/95 p-1 shadow-sm backdrop-blur-sm"
  >
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="rounded-md px-2 py-1 text-xs transition-colors"
      :class="
        editorUi.graphTool === tool.id
          ? 'bg-accent/20 text-accent'
          : 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary'
      "
      :title="t(tool.labelKey)"
      @click="setTool(tool.id)"
    >
      {{ t(tool.labelKey) }}
    </button>
    <button
      type="button"
      class="rounded-md px-2 py-1 text-xs text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
      :title="t('visual.graphTool.fit')"
      @click="editorUi.fitGraphToView()"
    >
      {{ t('visual.graphTool.fit') }}
    </button>
  </div>
</template>
