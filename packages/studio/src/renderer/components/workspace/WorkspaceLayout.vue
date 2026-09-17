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
const collapsed = computed(() => [false, false, workspace.structureCollapsed])
</script>

<template>
  <ColumnResizeSplit
    class="min-h-0 min-w-0 w-full flex-1"
    :widths="workspace.columnWidths"
    :collapsed="collapsed"
    @update:widths="workspace.setColumnWidths($event)"
  >
    <template #col-0>
      <div class="h-full min-h-0 select-none">
        <ProjectModuleTree />
      </div>
    </template>
    <template #col-1>
      <WorkspaceDockLayout />
    </template>
    <template #bar-1>
      <button
        type="button"
        class="relative z-10 flex h-16 w-5 select-none items-center justify-center rounded-md border border-border-subtle bg-surface-raised text-content-secondary opacity-0 shadow-sm transition-all duration-150 group-hover/resize:opacity-100 hover:bg-surface-overlay hover:text-content-primary"
        :title="workspace.structureCollapsed ? t('workspace.expandStructure') : t('workspace.collapseStructure')"
        @pointerdown.stop
        @click="workspace.setStructureCollapsed(!workspace.structureCollapsed)"
      >
        <StudioIcon
          :icon="workspace.structureCollapsed ? 'lucide:chevron-left' : 'lucide:chevron-right'"
          :size="14"
        />
      </button>
    </template>
    <template #col-2>
      <div class="h-full min-h-0 select-none">
        <StructureColumn />
      </div>
    </template>
  </ColumnResizeSplit>
</template>
