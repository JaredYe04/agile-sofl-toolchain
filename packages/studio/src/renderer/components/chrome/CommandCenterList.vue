<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CommandCenterItem } from '../../commandCenter/types'

const props = defineProps<{
  items: CommandCenterItem[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [index: number]
  execute: [index: number]
}>()

const { t } = useI18n()

const flatItems = computed(() => props.items)

const groups = computed(() => {
  const map = new Map<string, { key: string; items: Array<{ item: CommandCenterItem; flatIndex: number }> }>()
  flatItems.value.forEach((item, flatIndex) => {
    const key = item.group ?? 'commandCenter.group.default'
    const group = map.get(key) ?? { key, items: [] }
    group.items.push({ item, flatIndex })
    map.set(key, group)
  })
  return [...map.values()]
})

function onClick(flatIndex: number): void {
  emit('select', flatIndex)
  emit('execute', flatIndex)
}

function isSelected(flatIndex: number): boolean {
  return flatIndex === props.selectedIndex
}
</script>

<template>
  <div class="max-h-[min(400px,50vh)] overflow-y-auto py-1">
    <template v-if="items.length">
      <div v-for="group in groups" :key="group.key" class="px-1">
        <div class="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-content-muted">
          {{ t(group.key) }}
        </div>
        <button
          v-for="{ item, flatIndex } in group.items"
          :key="item.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150"
          :class="
            isSelected(flatIndex)
              ? 'bg-accent/15 text-content-primary'
              : 'text-content-secondary hover:bg-surface-base hover:text-content-primary'
          "
          @click="onClick(flatIndex)"
        >
          <span class="min-w-0 flex-1 truncate font-medium">{{ item.label }}</span>
          <span v-if="item.badge" class="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-content-muted">
            {{ item.badge }}
          </span>
          <span v-if="item.detail" class="shrink-0 max-w-[45%] truncate text-xs text-content-muted">
            {{ item.detail }}
          </span>
        </button>
      </div>
    </template>
    <p v-else class="px-3 py-4 text-center text-sm text-content-muted">
      {{ t('commandCenter.noResults') }}
    </p>
  </div>
</template>
