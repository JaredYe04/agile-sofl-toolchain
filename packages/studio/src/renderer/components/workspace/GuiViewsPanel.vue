<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GUI_MODEL_KEY } from '../../composables/guiModelContext'
import { useWorkspaceStore } from '../../stores/workspace'
import MonacoEditor from '../editor/MonacoEditor.vue'
import GuiDesignerCanvas from '../editor/gui/GuiDesignerCanvas.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import FullscreenPanel from './FullscreenPanel.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiViewsPanel requires GUI_MODEL_KEY')

const tabId = computed(() => workspace.guiTab?.id)
const selectedViewId = ref<string | null>(null)
const screens = computed(() => gui.model.value?.screens ?? [])
const guiViewOptions = computed(() => [
  { id: 'code', label: t('workspace.codeTab') },
  { id: 'visual', label: t('workspace.visualTab') }
])

function onGuiMode(id: string): void {
  workspace.guiMode = id === 'code' ? 'code' : 'visual'
}

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
  <FullscreenPanel panel-id="gui">
    <section class="flex h-full min-h-0 flex-col border-t border-border-subtle bg-surface-base">
      <DockPanelChrome panel="gui" :title="t('workspace.guiViews')" :dirty="workspace.isGuiDirty()">
        <template #actions>
          <SegmentedSwitch
            class="min-w-0 shrink"
            :model-value="workspace.guiMode"
            :options="guiViewOptions"
            @update:model-value="onGuiMode"
          />
        </template>
      </DockPanelChrome>
      <div class="min-h-0 flex-1">
        <GuiDesignerCanvas
          v-show="workspace.guiMode === 'visual'"
          :selected-view-id="selectedViewId"
          @update:selected-view-id="selectedViewId = $event"
        />
        <MonacoEditor v-if="tabId" v-show="workspace.guiMode === 'code'" :tab-id="tabId" />
      </div>
    </section>
  </FullscreenPanel>
</template>
