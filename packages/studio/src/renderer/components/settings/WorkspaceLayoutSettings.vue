<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/settings'
import { WORKSPACE_LAYOUT_PRESETS, type WorkspaceLayoutPresetId } from '../../lib/workspaceLayout'
import type { DockPanelId } from '../../lib/dockLayout'
import StudioIcon from '../ui/StudioIcon.vue'
import LayoutMiniPreview from './LayoutMiniPreview.vue'

const { t } = useI18n()
const settings = useSettingsStore()

const dragFrom = ref<number | null>(null)

const panelOptions = computed(() => [
  { id: 'informal' as DockPanelId, label: t('workspace.informalSpec') },
  { id: 'agent' as DockPanelId, label: t('agent.title') },
  { id: 'hybrid' as DockPanelId, label: t('workspace.hybridSpec') }
])

function onPreset(id: WorkspaceLayoutPresetId): void {
  settings.setWorkspaceLayoutPreset(id)
}

function onSlotPanel(slotIndex: 0 | 1 | 2, panel: DockPanelId): void {
  settings.setWorkspaceSlotPanel(slotIndex, panel)
}

const slotRows = computed(() => {
  const slots = settings.workspaceSlotPanels
  return ([0, 1, 2] as const).map((index) => ({ index, panel: slots[index] }))
})

function onDragStart(index: number, e: DragEvent): void {
  dragFrom.value = index
  e.dataTransfer?.setData('text/plain', String(index))
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
}

function onDrop(toIndex: number, e: DragEvent): void {
  e.preventDefault()
  const from = dragFrom.value ?? Number(e.dataTransfer?.getData('text/plain'))
  dragFrom.value = null
  if (!Number.isFinite(from) || from === toIndex) return
  settings.reorderWorkspaceSlots(from, toIndex)
}

function onDragEnd(): void {
  dragFrom.value = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h3 class="mb-2 text-[12px] font-medium text-content-muted">{{ t('settings.workspaceLayoutPresets') }}</h3>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="preset in WORKSPACE_LAYOUT_PRESETS"
          :key="preset.id"
          type="button"
          class="flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors"
          :class="
            settings.workspaceLayoutPreset === preset.id
              ? 'border-accent bg-accent/10'
              : 'border-border-subtle hover:bg-surface-overlay'
          "
          @click="onPreset(preset.id)"
        >
          <div class="h-14 w-full rounded border border-border-subtle/80 bg-surface-base p-0.5">
            <LayoutMiniPreview :preset-id="preset.id" />
          </div>
          <span class="text-[11px] leading-tight text-content-secondary">
            {{ t(`settings.workspaceLayout.${preset.id}`) }}
          </span>
        </button>
      </div>
    </div>

    <div>
      <h3 class="mb-1 text-[12px] font-medium text-content-muted">{{ t('settings.workspaceLayoutSlots') }}</h3>
      <p class="mb-2 text-[11px] text-content-muted">{{ t('settings.workspaceLayoutSlotsHint') }}</p>
      <ul class="flex flex-col gap-1">
        <li
          v-for="row in slotRows"
          :key="row.index"
          class="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-base px-2 py-1.5"
          :class="dragFrom === row.index ? 'opacity-60' : ''"
          draggable="true"
          @dragstart="onDragStart(row.index, $event)"
          @dragover="onDragOver"
          @drop="onDrop(row.index, $event)"
          @dragend="onDragEnd"
        >
          <span
            class="flex shrink-0 cursor-grab text-content-muted active:cursor-grabbing"
            :title="t('settings.workspaceLayoutDragSort')"
          >
            <StudioIcon icon="lucide:grip-vertical" :size="14" />
          </span>
          <span class="w-14 shrink-0 text-[11px] font-medium text-content-muted">
            {{ t('settings.workspaceLayoutSlot', { n: row.index + 1 }) }}
          </span>
          <select
            class="visual-field min-w-0 flex-1 px-2 py-1 text-[12px]"
            :value="row.panel"
            @change="onSlotPanel(row.index, ($event.target as HTMLSelectElement).value as DockPanelId)"
          >
            <option v-for="opt in panelOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </li>
      </ul>
    </div>
  </div>
</template>
