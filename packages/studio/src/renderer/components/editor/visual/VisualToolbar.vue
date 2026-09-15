<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { useEditorUiStore, type VisualSideView } from '../../../stores/editorUi'
import IconActionButton from '../../ui/IconActionButton.vue'

defineProps<{
  selection: TreeSelection
  parseFailed: boolean
  hasDiagnostics: boolean
  loading: boolean
  syncing?: boolean
  searchQuery: string
  hideSideViews?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  'update:searchQuery': [value: string]
}>()

const { t } = useI18n()
const editorUi = useEditorUiStore()

const sideViews = computed(() => [
  { id: 'tree' as VisualSideView, label: t('toolbar.viewTree') },
  { id: 'graph' as VisualSideView, label: t('toolbar.viewGraph') }
])

function onZoomInput(e: Event): void {
  const v = Number.parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v)) editorUi.setGraphZoom(v)
}
</script>

<template>
  <div
    class="flex h-[36px] min-w-0 shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-border-subtle bg-surface-base px-3"
  >
    <div v-if="!hideSideViews" class="flex shrink-0 rounded-lg border border-border-subtle p-0.5">
      <button
        v-for="sv in sideViews"
        :key="sv.id"
        type="button"
        class="rounded-md px-2.5 py-1 text-sm transition-colors duration-150 active:scale-[0.98]"
        :class="
          editorUi.sideView === sv.id
            ? 'bg-surface-raised text-content-primary shadow-sm'
            : 'text-content-secondary hover:text-content-primary'
        "
        @click="editorUi.setSideView(sv.id)"
      >
        {{ sv.label }}
      </button>
    </div>

    <template v-if="!hideSideViews && editorUi.sideView === 'graph'">
      <label class="flex items-center gap-1 text-xs text-content-secondary">
        <span>{{ t('visual.graphZoom') }}</span>
        <input
          type="number"
          min="25"
          max="200"
          step="5"
          class="visual-field w-14 px-1 py-0.5 text-xs"
          :value="editorUi.graphZoomPercent"
          @change="onZoomInput"
        />
        <span>%</span>
      </label>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        @click="editorUi.fitGraphToView()"
      >
        {{ t('visual.graphFit') }}
      </button>
    </template>

    <input
      type="search"
      class="visual-field ml-1 min-w-0 w-[min(140px,22%)] shrink px-2 py-1 text-xs placeholder:text-content-muted"
      :placeholder="t('visual.searchPlaceholder')"
      :value="searchQuery"
      @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
    />

    <div class="min-w-0 flex-1" />

    <div class="flex shrink-0 items-center gap-0.5">
      <IconActionButton
        v-if="syncing"
        icon="lucide:loader-circle"
        :label="t('visual.syncing')"
        spin
        disabled
      />
      <IconActionButton
        icon="lucide:refresh-cw"
        :label="t('visual.toolbar.refresh')"
        :disabled="loading"
        @click="emit('refresh')"
      />
    </div>
  </div>
</template>
