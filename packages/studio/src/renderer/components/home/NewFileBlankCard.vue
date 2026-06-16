<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Badge from '../editor/visual/ui/Badge.vue'
import { fileExtensionLabel, type TemplateEntry } from '../../composables/useNewFileDialog'

const props = defineProps<{ entry: TemplateEntry }>()
defineEmits<{ pick: [entry: TemplateEntry] }>()

const { t } = useI18n()

const ext = computed(() => fileExtensionLabel(props.entry.file))

const badgeVariant = computed(() => {
  if (ext.value === '.aspec') return 'semi-formal' as const
  if (ext.value === '.guispec') return 'neutral' as const
  return 'formal' as const
})
</script>

<template>
  <button
    type="button"
    class="group flex w-full gap-3 rounded-lg border border-dashed border-accent/30 p-4 text-left transition-colors duration-150 hover:border-accent/60 hover:bg-accent/5 active:scale-[0.99]"
    @click="$emit('pick', entry)"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15"
      aria-hidden="true"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <span class="font-medium text-content-primary">{{ t(entry.titleKey) }}</span>
        <Badge :variant="badgeVariant">{{ ext }}</Badge>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-content-secondary">{{ t(entry.descriptionKey) }}</p>
    </div>
  </button>
</template>
