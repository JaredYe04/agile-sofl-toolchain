<script setup lang="ts">
import type { DockNode, DockPanelId, DockZone } from '../../../lib/dockLayout'
import ResizeSplit from '../../ui/ResizeSplit.vue'
import InformalSpecPanel from '../InformalSpecPanel.vue'
import AgentSpecPanel from '../AgentSpecPanel.vue'
import HybridSpecPanel from '../HybridSpecPanel.vue'
import WorkspaceDockNode from './WorkspaceDockNode.vue'

defineProps<{
  node: DockNode
  path: number[]
  dragPanel: DockPanelId | null
  hoverTarget: DockPanelId | null
  hoverZone: DockZone | null
  panelTitle: (id: DockPanelId) => string
  panelDirty: (id: DockPanelId) => boolean
}>()

const emit = defineEmits<{
  dragStart: [panel: DockPanelId, e: PointerEvent]
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
        :drag-panel="dragPanel"
        :hover-target="hoverTarget"
        :hover-zone="hoverZone"
        :panel-title="panelTitle"
        :panel-dirty="panelDirty"
        @drag-start="(p, e) => emit('dragStart', p, e)"
        @ratio="(p, r) => emit('ratio', p, r)"
      />
    </template>
    <template #second>
      <WorkspaceDockNode
        :node="node.second"
        :path="[...path, 1]"
        :drag-panel="dragPanel"
        :hover-target="hoverTarget"
        :hover-zone="hoverZone"
        :panel-title="panelTitle"
        :panel-dirty="panelDirty"
        @drag-start="(p, e) => emit('dragStart', p, e)"
        @ratio="(p, r) => emit('ratio', p, r)"
      />
    </template>
  </ResizeSplit>
  <InformalSpecPanel
    v-else-if="node.panel === 'informal'"
    :title="panelTitle('informal')"
    :dirty="panelDirty('informal')"
    :drag-panel="dragPanel"
    :hover-target="hoverTarget"
    :hover-zone="hoverZone"
    @drag-start="emit('dragStart', 'informal', $event)"
  />
  <AgentSpecPanel
    v-else-if="node.panel === 'agent'"
    :title="panelTitle('agent')"
    :drag-panel="dragPanel"
    :hover-target="hoverTarget"
    :hover-zone="hoverZone"
    @drag-start="emit('dragStart', 'agent', $event)"
  />
  <HybridSpecPanel
    v-else
    :title="panelTitle('hybrid')"
    :dirty="panelDirty('hybrid')"
    :drag-panel="dragPanel"
    :hover-target="hoverTarget"
    :hover-zone="hoverZone"
    @drag-start="emit('dragStart', 'hybrid', $event)"
  />
</template>
