<script setup lang="ts">
import { useDocumentStore } from '../../stores/document'
import { useFileActions } from '../../composables/useFileActions'

const doc = useDocumentStore()
const files = useFileActions()

async function closeTab(id: string, e: MouseEvent): Promise<void> {
  e.stopPropagation()
  doc.setActive(id)
  const action = await files.confirmCloseTab(id)
  if (action === 'cancel') return
  doc.removeTab(id)
}
</script>

<template>
  <div class="flex h-[35px] shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border-subtle bg-surface-base px-1 pt-1">
    <button
      v-for="tab in doc.tabs"
      :key="tab.id"
      type="button"
      class="group titlebar-no-drag flex max-w-[200px] items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1 text-xs transition-colors duration-150"
      :class="
        tab.id === doc.activeTabId
          ? 'border-border-subtle bg-surface-raised text-content-primary'
          : 'border-transparent bg-transparent text-content-secondary hover:bg-surface-raised/60'
      "
      @click="doc.setActive(tab.id)"
    >
      <span class="truncate">{{ tab.title }}{{ tab.isDirty ? ' ●' : '' }}</span>
      <span
        class="ml-1 rounded p-0.5 text-content-muted opacity-0 transition-all duration-150 hover:bg-surface-overlay hover:text-content-primary group-hover:opacity-100"
        @click="closeTab(tab.id, $event)"
      >×</span>
    </button>
  </div>
</template>
