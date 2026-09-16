<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import SpecificationStructureTree from './SpecificationStructureTree.vue'
import ModuleGraphView from '../editor/visual/ModuleGraphView.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import type { TreeSelection } from '../../composables/useVisualModel'
import WorkspacePanel from './WorkspacePanel.vue'
import PanelTitle from './PanelTitle.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import VerticalResizeSplit from '../ui/VerticalResizeSplit.vue'
import { useInformalSpec } from '../../composables/useInformalSpec'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const informal = useInformalSpec(computed(() => workspace.informalTab?.id))
const informalSpec = informal.spec

const graph = computed(() => visual?.moduleGraph.value ?? null)

const structureViewOptions = computed(() => [
  { id: 'tree', label: t('workspace.treeTab') },
  { id: 'graph', label: t('workspace.graphTab') }
])

function onStructureMode(id: string): void {
  workspace.structureMode = id === 'graph' ? 'graph' : 'tree'
}

function onGraphSelect(sel: TreeSelection): void {
  if (!sel) return
  workspace.selectModule(sel.moduleName, sel)
}
</script>

<template>
  <WorkspacePanel panel="structure" class="flex flex-col bg-surface-base">
    <header
      class="flex h-[32px] min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-border-subtle px-2"
    >
      <PanelTitle :title="t('workspace.hierarchy')" />
      <SegmentedSwitch
        :model-value="workspace.structureMode"
        :options="structureViewOptions"
        @update:model-value="onStructureMode"
      />
    </header>
    <div class="min-h-0 flex-1">
      <VerticalResizeSplit
        v-if="workspace.structureMode === 'tree'"
        :ratio="workspace.structureSplitRatio"
        :min-top="0.18"
        :min-bottom="0.18"
        @update:ratio="workspace.structureSplitRatio = $event"
      >
        <template #top>
          <SpecificationStructureTree pane="informal" :spec="informalSpec" />
        </template>
        <template #bottom>
          <SpecificationStructureTree pane="hybrid" />
        </template>
      </VerticalResizeSplit>
      <ModuleGraphView
        v-else
        always-enabled
        :graph="graph as { nodes: []; edges: [] } | null"
        :selected="workspace.selection"
        @select="onGraphSelect"
      />
    </div>
  </WorkspacePanel>
</template>
