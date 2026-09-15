<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
import { revealInCodeEditor } from '../../composables/useRevealCode'
import { initSpecAssistProviders } from '../../specAssist/init'
import ResizeSplit from '../ui/ResizeSplit.vue'
import type { SerializableSpan } from '../editor/MonacoEditor.vue'

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
  if (id === 'code') {
    void nextTick(() => monacoRef.value?.relayout())
  }
}

watch(
  () => workspace.selection,
  (sel) => {
    visualRef.value?.setSelection?.(sel)
  }
)

watch(
  () => workspace.selectedModuleName,
  async (name, prev) => {
    if (!name || name === prev || workspace.hybridMode !== 'code') return
    const mod = workspace.selectedModule
    if (!mod) return
    await nextTick()
    monacoRef.value?.relayout()
    monacoRef.value?.revealSpan({
      start: mod.spanStart,
      end: mod.spanStart,
      line: 1,
      column: 1
    })
  }
)

function onVisualSelect(sel: TreeSelection): void {
  if (!sel) return
  workspace.selectModule(sel.moduleName, sel)
}

function onRevealSpan(span: SerializableSpan): void {
  void revealInCodeEditor(monacoRef.value, span, { hybrid: true })
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
          <div class="relative min-h-0 flex-1 overflow-hidden">
            <div
              class="absolute inset-0"
              :class="workspace.hybridMode === 'code' ? 'z-10' : 'invisible pointer-events-none z-0'"
            >
              <MonacoEditor
                v-if="hybridTabId"
                ref="monacoRef"
                :tab-id="hybridTabId"
                :active="workspace.hybridMode === 'code'"
              />
            </div>
            <div
              class="absolute inset-0"
              :class="workspace.hybridMode === 'visual' ? 'z-10' : 'hidden'"
            >
              <VisualEditor
                ref="visualRef"
                hide-navigator
                :forced-selection="workspace.selection"
                @reveal-span="onRevealSpan"
                @select="onVisualSelect"
              />
            </div>
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
      <div class="relative min-h-0 flex-1 overflow-hidden">
        <div
          class="absolute inset-0"
          :class="workspace.hybridMode === 'code' ? 'z-10' : 'invisible pointer-events-none z-0'"
        >
          <MonacoEditor
            v-if="hybridTabId"
            ref="monacoRef"
            :tab-id="hybridTabId"
            :active="workspace.hybridMode === 'code'"
          />
        </div>
        <div
          class="absolute inset-0"
          :class="workspace.hybridMode === 'visual' ? 'z-10' : 'hidden'"
        >
          <VisualEditor
            ref="visualRef"
            hide-navigator
            :forced-selection="workspace.selection"
            @reveal-span="onRevealSpan"
            @select="onVisualSelect"
          />
        </div>
      </div>
    </WorkspacePanel>
    </FullscreenPanel>
  </div>
</template>
