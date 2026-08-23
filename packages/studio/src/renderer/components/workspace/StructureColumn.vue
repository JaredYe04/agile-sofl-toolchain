<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import ModuleHierarchyTree from './ModuleHierarchyTree.vue'
import ModuleGraphView from '../editor/visual/ModuleGraphView.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import type { TreeSelection } from '../../composables/useVisualModel'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)

const graph = computed(() => visual?.moduleGraph.value ?? null)

function onGraphSelect(sel: TreeSelection): void {
  if (!sel) return
  workspace.selectModule(sel.moduleName, sel)
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface-base">
    <header class="flex h-[32px] min-w-0 shrink-0 items-center gap-1 overflow-hidden border-b border-border-subtle px-2">
      <h2 class="mr-auto min-w-0 truncate text-xs font-semibold text-content-primary">{{ t('workspace.hierarchy') }}</h2>
      <button
        type="button"
        class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
        :class="workspace.structureMode === 'tree' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
        :title="t('workspace.treeTab')"
        @click="workspace.structureMode = 'tree'"
      >
        {{ t('workspace.treeTabShort') }}
      </button>
      <button
        type="button"
        class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
        :class="workspace.structureMode === 'graph' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
        :title="t('workspace.graphTab')"
        @click="workspace.structureMode = 'graph'"
      >
        {{ t('workspace.graphTabShort') }}
      </button>
    </header>
    <div class="min-h-0 flex-1">
      <ModuleHierarchyTree v-if="workspace.structureMode === 'tree'" />
      <ModuleGraphView
        v-else
        always-enabled
        :graph="graph as { nodes: []; edges: [] } | null"
        :selected="workspace.selection"
        @select="onGraphSelect"
      />
    </div>
  </section>
</template>
