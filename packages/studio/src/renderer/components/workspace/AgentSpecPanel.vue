<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { DockPanelId, DockZone } from '../../lib/dockLayout'
import AgentPanel from './agent/AgentPanel.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import DockDropHighlight from './dock/DockDropHighlight.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useInformalSpec } from '../../composables/useInformalSpec'
import { applyHybridDocumentPatch } from '../../lib/applyHybridDocumentPatch'
import type { InformalPatchPayload } from '../../../preload/index'
import { computed } from 'vue'

defineProps<{
  title: string
  dragPanel: DockPanelId | null
  hoverTarget: DockPanelId | null
  hoverZone: DockZone | null
}>()

defineEmits<{ dragStart: [e: PointerEvent] }>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const tabId = computed(() => workspace.informalTab?.id)
const { tab, applyPatch } = useInformalSpec(tabId)

async function onApplyPatch(
  patch: InformalPatchPayload
): Promise<{ ok: boolean; error?: string; applied?: boolean }> {
  return applyPatch(patch)
}

async function onApplyHybridPatch(
  patch: InformalPatchPayload
): Promise<{ ok: boolean; error?: string; applied?: boolean }> {
  return applyHybridDocumentPatch(patch, {
    noTab: t('agent.noHybridTab'),
    applyFailed: t('agent.applyFailed')
  })
}
</script>

<template>
  <WorkspacePanel panel="agent" class="relative flex h-full min-h-0 flex-col" data-dock-host="agent">
    <DockDropHighlight :active="dragPanel !== null && hoverTarget === 'agent'" :zone="hoverZone" />
    <DockPanelChrome
      panel="agent"
      :title="title"
      :dragging="dragPanel !== null && hoverTarget === 'agent'"
      :drop-zone="hoverTarget === 'agent' ? hoverZone : null"
      @drag-start="(_p, e) => $emit('dragStart', e)"
    />
    <AgentPanel
      embed-in-dock
      class="min-h-0 flex-1"
      :informal-markdown="tab?.content ?? ''"
      :on-apply-patch="onApplyPatch"
      :on-apply-hybrid-patch="onApplyHybridPatch"
    />
  </WorkspacePanel>
</template>
