<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GUI_MODEL_KEY } from '../../composables/guiModelContext'
import { useWorkspaceStore } from '../../stores/workspace'
import MonacoEditor from '../editor/MonacoEditor.vue'
import GuiDesignerCanvas from '../editor/gui/GuiDesignerCanvas.vue'
import PanelTitle from './PanelTitle.vue'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiViewsPanel requires GUI_MODEL_KEY')

const tabId = computed(() => workspace.guiTab?.id)
const selectedViewId = ref<string | null>(null)
const screens = computed(() => gui.model.value?.screens ?? [])

watch(
  screens,
  (list) => {
    if (!list.length) {
      selectedViewId.value = null
      return
    }
    if (!selectedViewId.value || !list.some((s) => s.id === selectedViewId.value)) {
      selectedViewId.value = list[0]!.id
    }
  },
  { immediate: true }
)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col border-t border-border-subtle bg-surface-base">
    <header class="flex h-[32px] min-w-0 shrink-0 items-center gap-1 overflow-hidden px-2">
      <PanelTitle :title="t('workspace.guiViews')" :dirty="workspace.isGuiDirty()" />
      <button
        type="button"
        class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
        :class="workspace.guiMode === 'visual' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
        :title="t('workspace.visualTab')"
        @click="workspace.guiMode = 'visual'"
      >
        {{ t('workspace.visualTab') }}
      </button>
      <button
        type="button"
        class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px]"
        :class="workspace.guiMode === 'code' ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
        :title="t('workspace.codeTab')"
        @click="workspace.guiMode = 'code'"
      >
        {{ t('workspace.codeTab') }}
      </button>
    </header>
    <div class="min-h-0 flex-1">
      <GuiDesignerCanvas
        v-if="workspace.guiMode === 'visual'"
        :selected-view-id="selectedViewId"
        @update:selected-view-id="selectedViewId = $event"
      />
      <MonacoEditor v-else-if="tabId" :tab-id="tabId" />
    </div>
  </section>
</template>
