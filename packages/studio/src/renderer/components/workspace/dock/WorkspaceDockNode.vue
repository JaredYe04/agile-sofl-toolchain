<script setup lang="ts">
import type { DockNode, DockPanelId } from '../../../lib/dockLayout'
import ResizeSplit from '../../ui/ResizeSplit.vue'
import InformalSpecPanel from '../InformalSpecPanel.vue'
import AgentSpecPanel from '../AgentSpecPanel.vue'
import HybridSpecPanel from '../HybridSpecPanel.vue'
import WorkspaceDockNode from './WorkspaceDockNode.vue'

defineProps<{
  node: DockNode
  path: number[]
  panelTitle: (id: DockPanelId) => string
  panelDirty: (id: DockPanelId) => boolean
}>()

const emit = defineEmits<{
  ratio: [path: number[], ratio: number]
}>()
</script>

<template>
  <ResizeSplit
    v-if="node.kind === 'split'"
    :direction="node.direction"
    :ratio="node.ratio"
    @update:ratio="emit('ratio', path, $event)"
  >
    <template #first>
      <WorkspaceDockNode
        :node="node.first"
        :path="[...path, 0]"
        :panel-title="panelTitle"
        :panel-dirty="panelDirty"
        @ratio="(p, r) => emit('ratio', p, r)"
      />
    </template>
    <template #second>
      <WorkspaceDockNode
        :node="node.second"
        :path="[...path, 1]"
        :panel-title="panelTitle"
        :panel-dirty="panelDirty"
        @ratio="(p, r) => emit('ratio', p, r)"
      />
    </template>
  </ResizeSplit>
  <InformalSpecPanel
    v-else-if="node.panel === 'informal'"
    :title="panelTitle('informal')"
    :dirty="panelDirty('informal')"
  />
  <AgentSpecPanel v-else-if="node.panel === 'agent'" :title="panelTitle('agent')" />
  <HybridSpecPanel
    v-else
    :title="panelTitle('hybrid')"
    :dirty="panelDirty('hybrid')"
  />
</template>
