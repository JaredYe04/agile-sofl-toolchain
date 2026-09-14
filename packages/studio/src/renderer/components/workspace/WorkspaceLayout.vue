<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import ColumnResizeSplit from '../ui/ColumnResizeSplit.vue'
import ProjectModuleTree from './ProjectModuleTree.vue'
import StructureColumn from './StructureColumn.vue'
import WorkspaceDockLayout from './dock/WorkspaceDockLayout.vue'
import StudioIcon from '../ui/StudioIcon.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useVisualModel } from '../../composables/useVisualModel'
import { useGuiModel } from '../../composables/useGuiModel'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { GUI_MODEL_KEY } from '../../composables/guiModelContext'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const hybridTabId = computed(() => workspace.hybridTab?.id)
const visual = useVisualModel(hybridTabId)
provide(VISUAL_MODEL_KEY, visual)
const gui = useGuiModel(
  computed(() => workspace.guiTab?.id),
  { informalTabId: computed(() => workspace.informalTab?.id) }
)
provide(GUI_MODEL_KEY, gui)

/** [tree, center dock, structure] */
const collapsed = computed(() => [false, workspace.informalCollapsed, false])
</script>

<template>
  <ColumnResizeSplit
    class="min-h-0 min-w-0 w-full flex-1 select-none"
    :widths="workspace.columnWidths"
    :collapsed="collapsed"
    @update:widths="workspace.setColumnWidths($event)"
  >
    <template #col-0>
      <ProjectModuleTree />
    </template>
    <template #col-1>
      <WorkspaceDockLayout />
    </template>
    <template #bar-1>
      <button
        type="button"
        class="relative z-10 flex h-16 w-5 select-none items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-content-secondary opacity-0 shadow-sm transition-all duration-150 group-hover/resize:opacity-100 hover:bg-surface-overlay hover:text-content-primary"
        :title="workspace.informalCollapsed ? t('workspace.expandInformal') : t('workspace.collapseInformal')"
        @pointerdown.stop
        @click="workspace.setInformalCollapsed(!workspace.informalCollapsed)"
      >
        <StudioIcon
          :icon="workspace.informalCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-left'"
          :size="14"
        />
      </button>
    </template>
    <template #col-2>
      <StructureColumn />
    </template>
  </ColumnResizeSplit>
</template>
