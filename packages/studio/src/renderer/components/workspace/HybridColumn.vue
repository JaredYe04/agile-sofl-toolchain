<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import VisualEditor from '../editor/visual/VisualEditor.vue'
import GuiViewsPanel from './GuiViewsPanel.vue'
import HybridGenerateDialog from './HybridGenerateDialog.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import type { TreeSelection } from '../../composables/useVisualModel'
import VerticalResizeSplit from '../ui/VerticalResizeSplit.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { initSpecAssistProviders } from '../../specAssist/init'
import { insertHybridProcessSkeleton } from '../../specAssist/hybridSkeleton'
import WorkspacePanel from './WorkspacePanel.vue'
import PanelTitle from './PanelTitle.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import DropdownMenu, { type MenuItem } from '../ui/DropdownMenu.vue'

initSpecAssistProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const splitRatio = ref(0.62)
const showGenerate = ref(false)
const generateScope = ref<'hybrid' | 'module' | 'process' | 'scenario'>('hybrid')
const generateStages = ref<{ hybridSpec: boolean; modules: boolean; processes: boolean; scenarios: boolean } | undefined>()

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

function onInsertSkeleton(): void {
  void insertHybridProcessSkeleton(visual, t)
}

function openGenerate(scope: 'hybrid' | 'module' | 'process' | 'scenario' = 'hybrid'): void {
  generateScope.value = scope
  if (scope === 'hybrid') {
    generateStages.value = undefined
  } else {
    generateStages.value = {
      hybridSpec: false,
      modules: scope === 'module',
      processes: scope === 'process' || scope === 'scenario',
      scenarios: scope === 'scenario' || scope === 'process'
    }
  }
  showGenerate.value = true
}

const aiMenuItems = computed((): MenuItem[] => [
  { id: 'gen-hybrid', label: t('informal.generateHybrid'), action: () => openGenerate('hybrid') }
])

defineExpose({
  runEditCommand: (cmd: string) => monacoRef.value?.runEditCommand(cmd),
  formatDocument: () => monacoRef.value?.formatDocument() ?? Promise.resolve(false),
  revealSpan: (span: { start: number; end: number; line: number; column: number }) =>
    monacoRef.value?.revealSpan(span)
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
            <button
              type="button"
              class="min-w-0 shrink truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
              :title="t('hybrid.assist.skeletonTitle')"
              @click="onInsertSkeleton"
            >
              {{ t('hybrid.assist.skeleton') }}
            </button>
            <DropdownMenu :items="aiMenuItems">
              <template #trigger="{ toggle }">
                <button
                  type="button"
                  class="min-w-0 shrink truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10"
                  :title="t('hybrid.aiMenu')"
                  @click="toggle"
                >
                  {{ t('hybrid.aiMenu') }}
                </button>
              </template>
            </DropdownMenu>
            <SegmentedSwitch
              class="ml-auto min-w-0 max-w-[40%] shrink"
              :model-value="workspace.hybridMode"
              :options="hybridViewOptions"
              @update:model-value="onHybridMode"
            />
          </header>
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
        <button
          type="button"
          class="min-w-0 shrink truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
          :title="t('hybrid.assist.skeletonTitle')"
          @click="onInsertSkeleton"
        >
          {{ t('hybrid.assist.skeleton') }}
        </button>
        <DropdownMenu :items="aiMenuItems">
          <template #trigger="{ toggle }">
            <button
              type="button"
              class="min-w-0 shrink truncate whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10"
              :title="t('hybrid.aiMenu')"
              @click="toggle"
            >
              {{ t('hybrid.aiMenu') }}
            </button>
          </template>
        </DropdownMenu>
        <SegmentedSwitch
          class="ml-auto min-w-0 max-w-[40%] shrink"
          :model-value="workspace.hybridMode"
          :options="hybridViewOptions"
          @update:model-value="onHybridMode"
        />
      </header>
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
    <HybridGenerateDialog
      v-if="showGenerate"
      :source="workspace.informalTab?.content ?? ''"
      :initial-stages="generateStages"
      :process-name="workspace.selection?.kind === 'process' ? workspace.selection.processName : undefined"
      @close="showGenerate = false"
    />
  </section>
</template>
