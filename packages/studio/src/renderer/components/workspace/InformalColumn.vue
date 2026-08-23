<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import InformalAssistRail from './InformalAssistRail.vue'
import { useWorkspaceStore } from '../../stores/workspace'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const tabId = computed(() => workspace.informalTab?.id)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface-base">
    <header class="flex h-[32px] min-w-0 shrink-0 items-center justify-between overflow-hidden border-b border-border-subtle px-3">
      <h2 class="min-w-0 truncate text-xs font-semibold text-content-primary">{{ t('workspace.informalSpec') }}</h2>
      <span v-if="workspace.isInformalDirty()" class="text-[11px] text-accent">●</span>
    </header>
    <div class="flex min-h-0 flex-1">
      <InformalAssistRail />
      <div class="min-h-0 min-w-0 flex-1">
        <MonacoEditor v-if="tabId" :tab-id="tabId" />
        <p v-else class="p-4 text-xs text-content-muted">{{ t('workspace.noInformal') }}</p>
      </div>
    </div>
  </section>
</template>
