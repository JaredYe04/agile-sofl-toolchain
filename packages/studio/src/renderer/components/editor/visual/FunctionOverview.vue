<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VisualFunctionItem } from '../../../preload/index'

defineProps<{ fn: VisualFunctionItem; moduleName: string }>()
const emit = defineEmits<{ revealSpan: [span: VisualFunctionItem['span']] }>()
const { t } = useI18n()
</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header>
      <h2 class="text-lg font-semibold text-content-primary">
        {{ t('visual.function') }} {{ fn.name }}
      </h2>
      <p class="text-sm text-content-secondary">{{ t('visual.functionReadOnly') }}</p>
    </header>
    <button
      type="button"
      class="w-full overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-4 text-left font-mono text-sm text-content-primary hover:border-accent/40"
      @click="emit('revealSpan', fn.span)"
    >
      {{ fn.text }}
    </button>
  </div>
</template>
