<script setup lang="ts">
import TraceBadge from './TraceBadge.vue'
import TraceWorkbench from './TraceWorkbench.vue'
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import AtomicityTree from '../editor/visual/AtomicityTree.vue'
import ModuleStructurePane from '../editor/visual/ModuleStructurePane.vue'
import { useRefinementState } from '../../composables/useRefinementState'
import GuiViewsPanel from './GuiViewsPanel.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import FullscreenPanel from './FullscreenPanel.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { initSpecAssistProviders } from '../../specAssist/init'
import ResizeSplit from '../ui/ResizeSplit.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { sameSelection, selectionAtOffset, spanForHybridSelection } from '../../lib/structureNav'
import { filePathsEqual } from '../../stores/tabUtils'

initSpecAssistProviders()

defineProps<{
  title: string
  dirty?: boolean
}>()

const GUI_VIEWS_KEY = 'studio-show-gui-views'
const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const splitRatio = ref(0.62)
const showGuiViews = ref(localStorage.getItem(GUI_VIEWS_KEY) !== 'false')
let ignoreCursor = 0

const hybridTabId = computed(() => workspace.hybridTab?.id)
const mountCodeEditor = ref(true)
const { state: refinementState } = useRefinementState(
  computed(() => workspace.hybridMode === 'refine')
)
const hybridViewOptions = computed(() => [
  { id: 'code', label: t('workspace.codeTab') },
  { id: 'refine', label: t('workspace.refineTab') }
])

watch(showGuiViews, (value) => {
  localStorage.setItem(GUI_VIEWS_KEY, String(value))
})

function onHybridMode(id: string): void {
  const next = id === 'refine' ? 'refine' : 'code'
  if (workspace.hybridMode === 'code' && next !== 'code') {
    monacoRef.value?.flushToDocument()
  }
  workspace.hybridMode = next
  if (next === 'code') void nextTick(() => monacoRef.value?.relayout())
}

function paintFocus(): void {
  const span = spanForHybridSelection(visual?.model.value ?? null, workspace.selection)
  monacoRef.value?.setFocusHighlight(span)
}

watch(
  () => workspace.selection,
  async () => {
    await nextTick()
    paintFocus()
  }
)

watch(
  () => workspace.selectedModuleName,
  async (name, prev) => {
    if (!name || name === prev || workspace.hybridMode !== 'code') return
    if (workspace.selection && workspace.selection.kind !== 'module') return
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

async function revealSelection(): Promise<void> {
  const sel = workspace.selection
  if (!sel) return
  await nextTick()
  await nextTick()
  monacoRef.value?.relayout()
  let span = spanForHybridSelection(visual?.model.value ?? null, sel)
  if (
    !span &&
    (sel.kind === 'process' || sel.kind === 'function') &&
    window.studio?.findHybridSymbolSpan &&
    workspace.hybridTab
  ) {
    span = await window.studio.findHybridSymbolSpan({
      source: workspace.hybridTab.content,
      symbolName: sel.kind === 'process' ? sel.processName : sel.functionName,
      kind: sel.kind
    })
  }
  if (!span && sel.kind === 'module' && workspace.selectedModule) {
    const mod = workspace.selectedModule
    span = { start: mod.spanStart, end: mod.spanEnd, line: 1, column: 1 }
  }
  if (span) monacoRef.value?.revealSpan(span, { select: true })
  paintFocus()
}

watch(
  () => workspace.hybridRevealNonce,
  async () => {
    ignoreCursor += 1
    try {
      await revealSelection()
    } finally {
      await nextTick()
      ignoreCursor -= 1
    }
  }
)

watch(
  () => workspace.editorRevealNonce,
  async () => {
    const request = workspace.editorReveal
    if (!request || request.kind !== 'asfl') return
    const tab = workspace.hybridTab
    if (tab?.filePath && !filePathsEqual(tab.filePath, request.filePath)) return
    ignoreCursor += 1
    try {
      await nextTick()
      await nextTick()
      monacoRef.value?.relayout()
      monacoRef.value?.revealSpan(
        {
          start: request.start,
          end: request.end,
          line: request.line,
          column: request.column
        },
        { select: true }
      )
    } finally {
      await nextTick()
      ignoreCursor -= 1
    }
  }
)

function onCursor(offset: number): void {
  if (ignoreCursor > 0) return
  const sel = selectionAtOffset(visual?.model.value ?? null, offset)
  if (!sel || sameSelection(workspace.selection, sel)) return
  workspace.selectModule(sel.moduleName, sel, { persist: false })
}

onMounted(() => {
  void nextTick(() => paintFocus())
})
onUnmounted(() => {
  ignoreCursor = 0
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col" data-dock-host="hybrid">
    <ResizeSplit
      direction="vertical"
      :ratio="splitRatio"
      class="min-h-0 flex-1"
      @update:ratio="splitRatio = $event"
    >
      <template #first>
        <FullscreenPanel panel-id="hybrid">
          <WorkspacePanel panel="hybrid" class="flex h-full min-h-0 flex-col">
            <DockPanelChrome panel="hybrid" :title="title" :dirty="dirty">
              <template #actions>
                <div class="ml-auto flex min-w-0 shrink-0 items-center">
                  <TraceBadge side="hybrid" />
                  <SegmentedSwitch
                    class="min-w-0 shrink"
                    :model-value="workspace.hybridMode"
                    :options="hybridViewOptions"
                    @update:model-value="onHybridMode"
                  />
                </div>
              </template>
            </DockPanelChrome>
            <TraceWorkbench side="hybrid" />
            <div class="relative min-h-0 flex-1 overflow-hidden">
              <div
                class="absolute inset-0"
                :class="workspace.hybridMode === 'code' ? 'z-10' : 'invisible pointer-events-none z-0'"
              >
                <MonacoEditor
                  v-if="hybridTabId && mountCodeEditor"
                  ref="monacoRef"
                  :tab-id="hybridTabId"
                  :active="workspace.hybridMode === 'code'"
                  @cursor-offset="onCursor"
                />
              </div>
              <div v-if="workspace.hybridMode === 'refine'" class="absolute inset-0 z-10">
                <AtomicityTree class="h-full min-h-0" :state="refinementState" />
              </div>
            </div>
          </WorkspacePanel>
        </FullscreenPanel>
      </template>
      <template #second>
        <div class="flex h-full min-h-0 flex-col border-t border-border-subtle bg-surface-base">
          <div
            v-if="workspace.isGuiModuleSelected"
            class="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle px-2"
          >
            <label class="ml-auto flex items-center gap-1.5 text-[11px] text-content-secondary">
              <input v-model="showGuiViews" type="checkbox" class="rounded border-border-subtle" />
              {{ t('workspace.guiViews') }}
            </label>
          </div>
          <GuiViewsPanel
            v-if="workspace.isGuiModuleSelected && showGuiViews"
            class="min-h-0 flex-1"
          />
          <ModuleStructurePane v-else class="min-h-0 flex-1" />
        </div>
      </template>
    </ResizeSplit>
  </div>
</template>
