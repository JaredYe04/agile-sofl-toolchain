<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { useHistoryStore } from '../../stores/history'
import { HistoryKinds } from '../../history/kinds'
import { initSpecAssistProviders } from '../../specAssist/init'
import { listInformalAssistantProviders } from '../../specAssist/registry'
import { informalTemplate, type InformalTemplateId } from '../../specAssist/templates'
import { applyInformalSuggestion } from '../../specAssist/applyInformal'

initSpecAssistProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const history = useHistoryStore()

async function applyCurrent(suggestion: Parameters<typeof applyInformalSuggestion>[1]): Promise<void> {
  const tab = workspace.informalTab
  if (!tab) return
  const next = await applyInformalSuggestion(tab.content, suggestion)
  if (next !== tab.content) {
    history.applyDocument(tab.id, next, { kind: HistoryKinds.informalEdit, immediate: true })
  }
}

async function onTemplate(id: InformalTemplateId): Promise<void> {
  await applyCurrent(informalTemplate(id))
}

async function onExtract(): Promise<void> {
  const tab = workspace.informalTab
  if (!tab) return
  let source = tab.content
  for (const provider of listInformalAssistantProviders()) {
    const items = await provider.suggest({ source })
    for (const item of items) {
      source = await applyInformalSuggestion(source, item)
    }
  }
  if (source !== tab.content) {
    history.applyDocument(tab.id, source, { kind: HistoryKinds.informalEdit, immediate: true })
  }
}
</script>

<template>
  <div class="flex w-[92px] shrink-0 flex-col border-r border-border-subtle bg-surface-raised">
    <p class="px-2 py-1.5 text-[10px] font-semibold uppercase text-content-muted">
      {{ t('informal.assist.title') }}
    </p>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onTemplate('purpose')"
    >
      {{ t('informal.assist.purpose') }}
    </button>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onTemplate('module')"
    >
      {{ t('informal.assist.module') }}
    </button>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onTemplate('process')"
    >
      {{ t('informal.assist.process') }}
    </button>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onTemplate('data')"
    >
      {{ t('informal.assist.data') }}
    </button>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onTemplate('constraint')"
    >
      {{ t('informal.assist.constraint') }}
    </button>
    <button
      type="button"
      class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
      @click="onExtract"
    >
      {{ t('informal.assist.extract') }}
    </button>
  </div>
</template>
