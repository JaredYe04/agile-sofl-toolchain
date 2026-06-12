<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useLspStore } from '../../stores/lsp'
import { useDocumentDiagnosticsStore } from '../../stores/documentDiagnostics'

const { t } = useI18n()
const doc = useDocumentStore()
const lsp = useLspStore()
const documentDiagnostics = useDocumentDiagnosticsStore()

const pathLabel = computed(() => doc.activeTab?.filePath ?? doc.activeTab?.title ?? '—')

const issueSummary = computed(() => {
  const { error, warning, info } = documentDiagnostics.counts
  const total = error + warning + info
  if (total === 0) return t('status.noIssues')
  const parts: string[] = []
  if (error) parts.push(t('status.errors', { count: error }))
  if (warning) parts.push(t('status.warnings', { count: warning }))
  if (info) parts.push(t('status.infos', { count: info }))
  return parts.join(' · ')
})
</script>

<template>
  <footer
    class="flex h-[24px] shrink-0 items-center justify-between border-t border-border-subtle bg-surface-raised px-3 text-[11px] text-content-secondary"
  >
    <span class="truncate">{{ pathLabel }}</span>
    <div class="flex items-center gap-3">
      <span>{{ issueSummary }}</span>
      <span :title="lsp.message">{{ lsp.running ? t('status.lsp.connected') : t('status.lsp.disconnected') }}</span>
      <span>{{ t('status.ready') }}</span>
    </div>
  </footer>
</template>
