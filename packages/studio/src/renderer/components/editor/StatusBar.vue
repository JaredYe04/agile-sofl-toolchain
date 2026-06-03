<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useLspStore } from '../../stores/lsp'

const { t } = useI18n()
const doc = useDocumentStore()
const lsp = useLspStore()

const pathLabel = computed(() => doc.activeTab?.filePath ?? doc.activeTab?.title ?? '—')
const errorLabel = computed(() =>
  lsp.errorCount > 0 ? t('status.errors', { count: lsp.errorCount }) : t('status.noErrors')
)
</script>

<template>
  <footer
    class="flex h-[24px] shrink-0 items-center justify-between border-t border-border-subtle bg-surface-raised px-3 text-[11px] text-content-secondary"
  >
    <span class="truncate">{{ pathLabel }}</span>
    <div class="flex items-center gap-3">
      <span>{{ errorLabel }}</span>
      <span :title="lsp.message">{{ lsp.running ? t('status.lsp.connected') : t('status.lsp.disconnected') }}</span>
      <span>{{ t('status.ready') }}</span>
    </div>
  </footer>
</template>
