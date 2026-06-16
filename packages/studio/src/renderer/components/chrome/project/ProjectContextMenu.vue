<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectMenuAction, ProjectMenuItem } from '../../../composables/useProjectContextMenu'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  items: ProjectMenuItem[]
}>()

const emit = defineEmits<{ pick: [action: ProjectMenuAction]; close: [] }>()

const { t } = useI18n()

function onDocClick(): void {
  if (props.open) emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (props.open && e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="open"
    class="fixed z-[120] min-w-[180px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <template v-for="item in items" :key="item.id">
      <div v-if="item.separator" class="my-1 border-t border-border-subtle" />
      <button
        type="button"
        class="block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-40"
        :class="item.disabled ? 'text-content-muted' : 'text-content-primary'"
        :disabled="item.disabled"
        @click="!item.disabled && emit('pick', item.id)"
      >
        {{ t(item.labelKey) }}
      </button>
    </template>
  </div>
</template>
