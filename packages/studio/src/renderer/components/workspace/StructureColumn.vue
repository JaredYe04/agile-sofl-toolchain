<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SPEC_MAP_KINDS,
  buildSpecMap,
  isSpecMapKind,
  structureModeFromChrome,
  type SpecMapKind,
  type SpecMapRef
} from '@agile-sofl/editor-api'
import { useWorkspaceStore } from '../../stores/workspace'
import SpecificationStructureTree from './SpecificationStructureTree.vue'
import SpecMapCanvas from './SpecMapCanvas.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { GUI_MODEL_KEY } from '../../composables/guiModelContext'
import { useInformalSpec } from '../../composables/useInformalSpec'
import { toSpecMapSource } from '../../lib/specMapSource'
import type { TreeSelection } from '../../composables/useVisualModel'
import WorkspacePanel from './WorkspacePanel.vue'
import PanelTitle from './PanelTitle.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import VerticalResizeSplit from '../ui/VerticalResizeSplit.vue'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const gui = inject(GUI_MODEL_KEY, null)
const informal = useInformalSpec(computed(() => workspace.informalTab?.id))

const chromeMode = computed(() => (workspace.structureMode === 'tree' ? 'tree' : 'map'))
const mapKind = computed<SpecMapKind>(() =>
  isSpecMapKind(workspace.structureMode) ? workspace.structureMode : 'architecture'
)

const structureViewOptions = computed(() => [
  { id: 'tree', label: t('workspace.treeTab') },
  { id: 'map', label: t('workspace.graphTab') }
])

const mapKindOptions = computed(() =>
  SPEC_MAP_KINDS.map((id) => ({ value: id, label: t(`workspace.specMap.${id}`) }))
)

const specMap = computed(() =>
  buildSpecMap(
    mapKind.value,
    toSpecMapSource({
      informal: informal.spec.value,
      hybrid: visual?.model.value ?? null,
      gui: gui?.model.value ?? null
    })
  )
)

function onStructureMode(id: string): void {
  workspace.structureMode = structureModeFromChrome(id, workspace.structureMode)
}

function onMapKind(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isSpecMapKind(value)) workspace.structureMode = value
}

function onMapSelect(ref: SpecMapRef): void {
  if (ref.spec === 'informal') {
    workspace.revealInformalInDocument(ref.id)
    return
  }
  if (ref.spec === 'gui') {
    workspace.revealGuiScreen(ref.screenId)
    return
  }
  const selection: TreeSelection = ref.processName
    ? { kind: 'process', moduleName: ref.moduleName, processName: ref.processName }
    : ref.functionName
      ? { kind: 'function', moduleName: ref.moduleName, functionName: ref.functionName }
      : { kind: 'module', moduleName: ref.moduleName }
  workspace.revealHybridInCode(ref.moduleName, selection)
}
</script>

<template>
  <WorkspacePanel panel="structure" class="flex flex-col bg-surface-base">
    <header
      class="flex h-[32px] min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-border-subtle px-2"
    >
      <PanelTitle :title="t('workspace.hierarchy')" />
      <SegmentedSwitch
        :model-value="chromeMode"
        :options="structureViewOptions"
        @update:model-value="onStructureMode"
      />
    </header>
    <div
      v-if="chromeMode === 'map'"
      class="flex h-8 shrink-0 items-center border-b border-border-subtle px-2"
    >
      <select
        class="h-6 min-w-0 flex-1 truncate rounded-md border border-border-subtle bg-surface-raised px-1.5 text-[11px] text-content-primary"
        :value="mapKind"
        @change="onMapKind"
      >
        <option v-for="opt in mapKindOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <div class="min-h-0 flex-1">
      <VerticalResizeSplit
        v-if="workspace.structureMode === 'tree'"
        :ratio="workspace.structureSplitRatio"
        :min-top="0.18"
        :min-bottom="0.18"
        @update:ratio="workspace.structureSplitRatio = $event"
      >
        <template #top>
          <SpecificationStructureTree pane="informal" :spec="informal.spec" />
        </template>
        <template #bottom>
          <SpecificationStructureTree pane="hybrid" />
        </template>
      </VerticalResizeSplit>
      <SpecMapCanvas v-else :map="specMap" @select="onMapSelect" />
    </div>
  </WorkspacePanel>
</template>
