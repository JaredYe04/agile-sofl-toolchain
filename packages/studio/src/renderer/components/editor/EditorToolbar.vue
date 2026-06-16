<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorUiStore, type ViewMode } from '../../stores/editorUi'

const { t } = useI18n()
const editorUi = useEditorUiStore()

const modes = computed(() => [
  { id: 'split' as ViewMode, label: t('toolbar.viewSplit') },
  { id: 'code' as ViewMode, label: t('toolbar.viewCode') },
  { id: 'visual' as ViewMode, label: t('toolbar.viewVisual') }
])

const emit = defineEmits<{ format: [] }>()

const showMonacoToggles = computed(() => editorUi.viewMode === 'code' || editorUi.viewMode === 'split')
</script>

<template>
  <div
    class="flex h-[36px] shrink-0 items-center justify-between border-b border-border-subtle bg-surface-base px-3"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="rounded-md p-1.5 text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
        :title="t('sidebar.toggle')"
        :aria-pressed="editorUi.showProjectSidebar"
        @click="editorUi.toggleProjectSidebar()"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
      <div class="flex rounded-lg border border-border-subtle p-0.5">
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          class="rounded-md px-3 py-1 text-sm transition-colors duration-150 active:scale-[0.98]"
          :class="
            editorUi.viewMode === mode.id
              ? 'bg-surface-raised text-content-primary shadow-sm'
              : 'text-content-secondary hover:text-content-primary'
          "
          @click="editorUi.setViewMode(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <div v-if="showMonacoToggles" class="flex items-center gap-3 text-sm text-content-secondary">
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
        @click="emit('format')"
      >
        {{ t('toolbar.format') }}
      </button>
      <label class="flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-content-primary">
        <input
          type="checkbox"
          class="rounded border-border-subtle"
          :checked="editorUi.showMinimap"
          @change="editorUi.setShowMinimap(($event.target as HTMLInputElement).checked)"
        />
        {{ t('toolbar.minimap') }}
      </label>
      <label class="flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-content-primary">
        <input
          type="checkbox"
          class="rounded border-border-subtle"
          :checked="editorUi.showLineNumbers"
          @change="editorUi.setShowLineNumbers(($event.target as HTMLInputElement).checked)"
        />
        {{ t('toolbar.lineNumbers') }}
      </label>
    </div>
  </div>
</template>
