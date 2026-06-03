<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useFileActions } from '../../composables/useFileActions'
import { HOME_TAB_ID } from '../../stores/tabUtils'

const { t } = useI18n()
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
  <div
    class="flex h-[38px] shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border-subtle bg-surface-base px-1 pt-1"
  >
    <button
      v-for="tab in doc.tabs"
      :key="tab.id"
      type="button"
      class="group titlebar-no-drag flex max-w-[220px] items-center gap-2 rounded-t-lg border border-b-0 px-3.5 py-1.5 text-sm transition-colors duration-150"
      :class="
        tab.id === doc.activeTabId
          ? 'border-border-subtle bg-surface-raised text-content-primary'
          : 'border-transparent bg-transparent text-content-secondary hover:bg-surface-raised/60'
      "
      @click="doc.setActive(tab.id)"
    >
      <span v-if="tab.kind === 'home'" class="shrink-0 text-accent" aria-hidden="true">⌂</span>
      <span class="truncate">{{ tab.kind === 'home' ? t('tab.home') : tab.title }}{{ tab.isDirty ? ' ●' : '' }}</span>
      <span
        v-if="tab.id !== HOME_TAB_ID"
        class="ml-0.5 shrink-0 rounded p-0.5 text-content-muted transition-all duration-150 hover:bg-surface-overlay hover:text-content-primary"
        :class="tab.id === doc.activeTabId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
        @click="closeTab(tab.id, $event)"
      >×</span>
    </button>
  </div>
</template>
