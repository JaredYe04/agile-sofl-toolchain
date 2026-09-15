<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import VisualEditor from '../editor/visual/VisualEditor.vue'
import GuiViewsPanel from './GuiViewsPanel.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import type { TreeSelection } from '../../composables/useVisualModel'
import { revealInCodeEditor } from '../../composables/useRevealCode'
import VerticalResizeSplit from '../ui/VerticalResizeSplit.vue'
import { initSpecAssistProviders } from '../../specAssist/init'
import WorkspacePanel from './WorkspacePanel.vue'
import PanelTitle from './PanelTitle.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import type { SerializableSpan } from '../editor/MonacoEditor.vue'

initSpecAssistProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const splitRatio = ref(0.62)

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

defineExpose({
  runEditCommand: (cmd: string) => monacoRef.value?.runEditCommand(cmd),
  formatDocument: () => monacoRef.value?.formatDocument() ?? Promise.resolve(false),
  revealSpan: (span: SerializableSpan) => void revealInCodeEditor(monacoRef.value, span, { hybrid: true })
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface-base">
    <VerticalResizeSplit
      v-if="workspace.isGuiModuleSelected"
      class="min-h-0 flex-1"
      :ratio="splitRatio"
      @update:ratio="splitRatio = $event"
    >
      <template #top>
        <WorkspacePanel panel="hybrid" class="flex flex-col">
          <header
            class="flex h-[32px] min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-hidden border-b border-border-subtle px-2"
          >
            <PanelTitle :title="t('workspace.hybridSpec')" :dirty="workspace.isHybridDirty()" />
            <SegmentedSwitch
              class="ml-auto min-w-0 shrink"
              :model-value="workspace.hybridMode"
              :options="hybridViewOptions"
              @update:model-value="onHybridMode"
            />
          </header>
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
      </template>
      <template #bottom>
        <WorkspacePanel panel="gui">
          <GuiViewsPanel />
        </WorkspacePanel>
      </template>
    </VerticalResizeSplit>
    <WorkspacePanel v-else panel="hybrid" class="flex flex-col">
      <header
        class="flex h-[32px] min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-hidden border-b border-border-subtle px-2"
      >
        <PanelTitle :title="t('workspace.hybridSpec')" :dirty="workspace.isHybridDirty()" />
        <SegmentedSwitch
          class="ml-auto min-w-0 shrink"
          :model-value="workspace.hybridMode"
          :options="hybridViewOptions"
          @update:model-value="onHybridMode"
        />
      </header>
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
  </section>
</template>
