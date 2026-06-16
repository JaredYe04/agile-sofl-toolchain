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
    class="rounded-lg border border-border-subtle p-3 text-left transition-colors duration-150 hover:border-accent/30 hover:bg-surface-overlay active:scale-[0.99]"
    @click="$emit('pick', entry)"
  >
    <div class="flex items-start justify-between gap-2">
      <span class="text-sm font-medium text-content-primary">{{ t(entry.titleKey) }}</span>
      <Badge :variant="badgeVariant">{{ ext }}</Badge>
    </div>
    <p class="mt-1 text-xs leading-relaxed text-content-secondary">{{ t(entry.descriptionKey) }}</p>
  </button>
</template>
