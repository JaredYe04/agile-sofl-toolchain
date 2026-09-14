<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DockPanelId, DockZone } from '../../lib/dockLayout'
import MonacoEditor from '../editor/MonacoEditor.vue'
import VisualEditor from '../editor/visual/VisualEditor.vue'
import GuiViewsPanel from './GuiViewsPanel.vue'
import HybridGenerateDialog from './HybridGenerateDialog.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import DockDropHighlight from './dock/DockDropHighlight.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import DropdownMenu, { type MenuItem } from '../ui/DropdownMenu.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import type { TreeSelection } from '../../composables/useVisualModel'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { initSpecAssistProviders } from '../../specAssist/init'
import { insertHybridProcessSkeleton } from '../../specAssist/hybridSkeleton'
import ResizeSplit from '../ui/ResizeSplit.vue'

initSpecAssistProviders()

defineProps<{
  title: string
  dirty?: boolean
  dragPanel: DockPanelId | null
  hoverTarget: DockPanelId | null
  hoverZone: DockZone | null
}>()

defineEmits<{ dragStart: [e: PointerEvent] }>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const guiSplitRatio = ref(0.62)
const showGenerate = ref(false)
const generateStages = ref<
  { hybridSpec: boolean; modules: boolean; processes: boolean; scenarios: boolean } | undefined
>()

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

function openGenerate(): void {
  generateStages.value = undefined
  showGenerate.value = true
}

const aiMenuItems = computed((): MenuItem[] => [
  { id: 'gen-hybrid', label: t('informal.generateHybrid'), action: () => openGenerate() }
])
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col" data-dock-host="hybrid">
    <DockDropHighlight :active="dragPanel !== null && hoverTarget === 'hybrid'" :zone="hoverZone" />
    <ResizeSplit
      v-if="workspace.isGuiModuleSelected"
      direction="vertical"
      :ratio="guiSplitRatio"
      class="min-h-0 flex-1"
      @update:ratio="guiSplitRatio = $event"
    >
      <template #first>
        <WorkspacePanel panel="hybrid" class="flex h-full min-h-0 flex-col">
          <DockPanelChrome
            panel="hybrid"
            :title="title"
            :dirty="dirty"
            :dragging="dragPanel !== null && hoverTarget === 'hybrid'"
            :drop-zone="null"
            @drag-start="(_p, e) => $emit('dragStart', e)"
          >
            <template #actions>
              <div data-dock-no-drag class="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
                  :title="t('hybrid.assist.skeletonTitle')"
                  @click="onInsertSkeleton"
                >
                  {{ t('hybrid.assist.skeleton') }}
                </button>
                <DropdownMenu :items="aiMenuItems" teleport>
                  <template #trigger="{ toggle }">
                    <button
                      type="button"
                      class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10"
                      :title="t('hybrid.aiMenu')"
                      @click="toggle"
                    >
                      {{ t('hybrid.aiMenu') }}
                    </button>
                  </template>
                </DropdownMenu>
                <SegmentedSwitch
                  class="ml-auto min-w-0 shrink"
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
      </template>
      <template #second>
        <WorkspacePanel panel="gui" class="h-full min-h-0">
          <GuiViewsPanel />
        </WorkspacePanel>
      </template>
    </ResizeSplit>
    <WorkspacePanel v-else panel="hybrid" class="flex h-full min-h-0 flex-col">
      <DockPanelChrome
        panel="hybrid"
        :title="title"
        :dirty="dirty"
        :dragging="dragPanel !== null && hoverTarget === 'hybrid'"
        :drop-zone="null"
        @drag-start="(_p, e) => $emit('dragStart', e)"
      >
        <template #actions>
          <div data-dock-no-drag class="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
              :title="t('hybrid.assist.skeletonTitle')"
              @click="onInsertSkeleton"
            >
              {{ t('hybrid.assist.skeleton') }}
            </button>
            <DropdownMenu :items="aiMenuItems" teleport>
              <template #trigger="{ toggle }">
                <button
                  type="button"
                  class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent/10"
                  :title="t('hybrid.aiMenu')"
                  @click="toggle"
                >
                  {{ t('hybrid.aiMenu') }}
                </button>
              </template>
            </DropdownMenu>
            <SegmentedSwitch
              class="ml-auto min-w-0 shrink"
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
    <HybridGenerateDialog
      v-if="showGenerate"
      :source="workspace.informalTab?.content ?? ''"
      :initial-stages="generateStages"
      @close="showGenerate = false"
    />
  </div>
</template>
