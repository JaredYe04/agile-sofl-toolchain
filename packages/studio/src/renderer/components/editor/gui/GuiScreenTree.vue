<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GuiScreenDto } from '../../../preload/index'

defineProps<{
  screens: GuiScreenDto[]
  selectedId: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <div class="border-r border-border-subtle p-3">
    <p class="mb-2 text-xs font-medium text-content-secondary">{{ t('gui.screens') }}</p>
    <ul class="space-y-1">
      <li v-for="s in screens" :key="s.id">
        <button
          type="button"
          class="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-surface-overlay"
          :class="selectedId === s.id ? 'bg-surface-overlay font-medium text-content-primary' : 'text-content-secondary'"
          @click="emit('select', s.id)"
        >
          {{ s.title ?? s.name }}
        </button>
      </li>
    </ul>
  </div>
</template>
