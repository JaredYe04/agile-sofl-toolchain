<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DockPanelId } from '../../../lib/dockLayout'
import { useSettingsStore } from '../../../stores/settings'
import WorkspaceDockNode from './WorkspaceDockNode.vue'
import { useWorkspaceStore } from '../../../stores/workspace'

const { t } = useI18n()
const settings = useSettingsStore()
const workspace = useWorkspaceStore()

const layout = computed(() => settings.workspaceDockLayout)

function panelTitle(id: DockPanelId): string {
  if (id === 'informal') return t('workspace.informalSpec')
  if (id === 'agent') return t('agent.title')
  return t('workspace.hybridSpec')
}

function onRatio(path: number[], ratio: number): void {
  settings.setWorkspaceSplitRatio(path, ratio)
}

function panelDirty(id: DockPanelId): boolean {
  if (id === 'informal') return workspace.isInformalDirty()
  if (id === 'hybrid') return workspace.isHybridDirty()
  return false
}
</script>

<template>
  <div class="relative h-full min-h-0 w-full min-w-0 bg-surface-base">
    <WorkspaceDockNode
      :node="layout"
      :path="[]"
      :panel-title="panelTitle"
      :panel-dirty="panelDirty"
      @ratio="onRatio"
    />
  </div>
</template>
