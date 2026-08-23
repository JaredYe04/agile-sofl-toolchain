<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../editor/MonacoEditor.vue'
import VisualEditor from '../editor/visual/VisualEditor.vue'
import GuiViewsPanel from './GuiViewsPanel.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import type { TreeSelection } from '../../composables/useVisualModel'
import VerticalResizeSplit from '../ui/VerticalResizeSplit.vue'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import { initSpecAssistProviders } from '../../specAssist/init'
import { insertHybridProcessSkeleton } from '../../specAssist/hybridSkeleton'

initSpecAssistProviders()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const monacoRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const visualRef = ref<InstanceType<typeof VisualEditor> | null>(null)
const splitRatio = ref(0.62)

const hybridTabId = computed(() => workspace.hybridTab?.id)

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
        <div class="flex h-full min-h-0 flex-col">
          <header class="flex h-[32px] min-w-0 shrink-0 items-center gap-1 overflow-hidden border-b border-border-subtle px-2">
            <h2 class="mr-auto min-w-0 truncate text-xs font-semibold text-content-primary">{{ t('workspace.hybridSpec') }}</h2>
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
              :title="t('hybrid.assist.skeletonTitle')"
              @click="onInsertSkeleton"
            >
              {{ t('hybrid.assist.skeleton') }}
            </button>
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
              :class="workspace.hybridMode === 'code' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
              :title="t('workspace.codeTab')"
              @click="workspace.hybridMode = 'code'"
            >
              {{ t('workspace.codeTab') }}
            </button>
            <button
              type="button"
              class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
              :class="workspace.hybridMode === 'visual' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
              :title="t('workspace.visualTab')"
              @click="workspace.hybridMode = 'visual'"
            >
              {{ t('workspace.visualTab') }}
            </button>
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
        </div>
      </template>
      <template #bottom>
        <GuiViewsPanel />
      </template>
    </VerticalResizeSplit>
    <div v-else class="flex h-full min-h-0 flex-col">
      <header class="flex h-[32px] min-w-0 shrink-0 items-center gap-1 overflow-hidden border-b border-border-subtle px-2">
        <h2 class="mr-auto min-w-0 truncate text-xs font-semibold text-content-primary">{{ t('workspace.hybridSpec') }}</h2>
        <button
          type="button"
          class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay"
          :title="t('hybrid.assist.skeletonTitle')"
          @click="onInsertSkeleton"
        >
          {{ t('hybrid.assist.skeleton') }}
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
          :class="workspace.hybridMode === 'code' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
          :title="t('workspace.codeTab')"
          @click="workspace.hybridMode = 'code'"
        >
          {{ t('workspace.codeTab') }}
        </button>
        <button
          type="button"
          class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
          :class="workspace.hybridMode === 'visual' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
          :title="t('workspace.visualTab')"
          @click="workspace.hybridMode = 'visual'"
        >
          {{ t('workspace.visualTab') }}
        </button>
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
    </div>
  </section>
</template>
