<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SerializableSpan, VisualGuiBlock, VisualModuleSummary } from '../../../preload/index'

const props = defineProps<{
  gui: VisualGuiBlock
  module: VisualModuleSummary
  disabled?: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: SerializableSpan]
}>()

const { t } = useI18n()
const screens = computed(() => props.gui.screens)
</script>

<template>
  <section class="rounded-lg border border-border-subtle bg-surface-raised p-4">
    <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.gui') }}</h3>
    <p class="mb-2 text-xs text-content-secondary">{{ t('gui.hybridTraceHint') }}</p>
    <button type="button" class="mb-3 text-sm text-accent hover:underline" @click="emit('revealSpan', gui.span)">
      {{ gui.name }}
    </button>
    <ul class="space-y-1">
      <li
        v-for="screen in screens"
        :key="screen.name"
        class="flex items-center justify-between rounded border border-border-subtle px-3 py-2 text-sm"
      >
        <button type="button" class="text-left hover:text-accent" @click="emit('revealSpan', screen.span)">
          {{ screen.name }}
        </button>
        <span v-if="screen.triggersProcess" class="text-xs text-content-muted">→ {{ screen.triggersProcess }}</span>
      </li>
    </ul>
  </section>
</template>
