<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import VisualEditor from '../editor/visual/VisualEditor.vue'
import GuiViewsPanel from './GuiViewsPanel.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import FullscreenPanel from './FullscreenPanel.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import type { TreeSelection } from '../../composables/useVisualModel'
import { initSpecAssistProviders } from '../../specAssist/init'
import ResizeSplit from '../ui/ResizeSplit.vue'

initSpecAssistProviders()

defineProps<{
  title: string
  dirty?: boolean
}>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const guiSplitRatio = ref(0.62)

const hybridTabId = computed(() => workspace.hybridTab?.id)
const hybridViewOptions = computed(() => [
  { id: 'code', label: t('workspace.codeTab') },
  { id: 'visual', label: t('workspace.visualTab') }
])

function onHybridMode(id: string): void {
  workspace.hybridMode = id === 'code' ? 'code' : 'visual'
}

watch(
  () => workspace.selection,
  (sel) => {
    visualRef.value?.setSelection?.(sel)
  }
)

watch(
  () => workspace.selectedModule,
  (mod) => {
    if (!mod || workspace.hybridMode !== 'code') return
    monacoRef.value?.revealSpan({
      start: mod.spanStart,
      end: mod.spanEnd,
      line: 1,
      column: 1
    })
  }
)

function onVisualSelect(sel: TreeSelection): void {
  if (!sel) return
  workspace.selectModule(sel.moduleName, sel)
}

</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col" data-dock-host="hybrid">
    <ResizeSplit
      v-if="workspace.isGuiModuleSelected"
      direction="vertical"
      :ratio="guiSplitRatio"
      class="min-h-0 flex-1"
      @update:ratio="guiSplitRatio = $event"
    >
      <template #first>
        <FullscreenPanel panel-id="hybrid">
        <WorkspacePanel panel="hybrid" class="flex h-full min-h-0 flex-col">
          <DockPanelChrome panel="hybrid" :title="title" :dirty="dirty">
            <template #actions>
              <div class="ml-auto flex min-w-0 shrink-0 items-center">
                <SegmentedSwitch
                  class="min-w-0 shrink"
                  :model-value="workspace.hybridMode"
                  :options="hybridViewOptions"
                  @update:model-value="onHybridMode"
                />
              </div>
            </template>
          </DockPanelChrome>
          <div class="min-h-0 flex-1">
            <MonacoEditor
              v-show="workspace.hybridMode === 'code'"
              v-if="hybridTabId"
              ref="monacoRef"
              :tab-id="hybridTabId"
            />
            <VisualEditor
              v-show="workspace.hybridMode === 'visual'"
              ref="visualRef"
              hide-navigator
              :forced-selection="workspace.selection"
              @reveal-span="monacoRef?.revealSpan($event)"
              @select="onVisualSelect"
            />
          </div>
        </WorkspacePanel>
        </FullscreenPanel>
      </template>
      <template #second>
        <WorkspacePanel panel="gui" class="h-full min-h-0">
          <GuiViewsPanel />
        </WorkspacePanel>
      </template>
    </ResizeSplit>
    <FullscreenPanel v-if="!workspace.isGuiModuleSelected" panel-id="hybrid">
    <WorkspacePanel panel="hybrid" class="flex h-full min-h-0 flex-col">
      <DockPanelChrome panel="hybrid" :title="title" :dirty="dirty">
        <template #actions>
          <div class="ml-auto flex min-w-0 shrink-0 items-center">
            <SegmentedSwitch
              class="min-w-0 shrink"
              :model-value="workspace.hybridMode"
              :options="hybridViewOptions"
              @update:model-value="onHybridMode"
            />
          </div>
        </template>
      </DockPanelChrome>
      <div class="min-h-0 flex-1">
        <MonacoEditor v-show="workspace.hybridMode === 'code'" v-if="hybridTabId" ref="monacoRef" :tab-id="hybridTabId" />
        <VisualEditor
          v-show="workspace.hybridMode === 'visual'"
          ref="visualRef"
          hide-navigator
          :forced-selection="workspace.selection"
          @reveal-span="monacoRef?.revealSpan($event)"
          @select="onVisualSelect"
        />
      </div>
    </WorkspacePanel>
    </FullscreenPanel>
  </div>
</template>
