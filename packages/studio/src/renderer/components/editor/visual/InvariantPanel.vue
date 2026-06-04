<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VisualInvariantItem } from '../../../preload/index'

defineProps<{
  invariants: VisualInvariantItem[]
}>()

const emit = defineEmits<{
  revealSpan: [span: VisualInvariantItem['span']]
}>()

const { t } = useI18n()
</script>

<template>
  <section v-if="invariants.length" class="space-y-2">
    <h3 class="text-sm font-medium text-content-secondary">{{ t('visual.section.inv') }}</h3>
    <ul class="space-y-2">
      <li
        v-for="(inv, i) in invariants"
        :key="i"
        class="rounded-lg border border-border-subtle bg-surface-raised p-3"
      >
        <button
          type="button"
          class="w-full text-left font-mono text-sm text-content-primary hover:text-accent"
          @click="emit('revealSpan', inv.span)"
        >
          {{ inv.text }}
        </button>
      </li>
    </ul>
  </section>
</template>
