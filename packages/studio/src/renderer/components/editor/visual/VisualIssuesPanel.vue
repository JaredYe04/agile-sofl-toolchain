<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiagnosticSummary } from '../../../preload/index'
import { truncateDiagnostic } from '../../../utils/truncateDiagnostic'

const props = defineProps<{
  diagnostics: DiagnosticSummary[]
  open: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: DiagnosticSummary['span']]
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

const errors = computed(() => props.diagnostics.filter((d) => d.severity === 'error').slice(0, 20))
</script>

<template>
  <div v-if="open && errors.length" class="studio-text-selectable border-b border-border-subtle bg-surface-raised px-3 py-2">
    <div class="flex items-center justify-between text-xs font-medium text-content-secondary">
      <span>{{ t('visual.issues.title', { count: errors.length }) }}</span>
      <button type="button" class="hover:text-content-primary" @click="emit('update:open', false)">
        {{ t('visual.issues.close') }}
      </button>
    </div>
    <ul class="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs">
      <li v-for="(d, i) in errors" :key="i">
        <button type="button" class="text-left text-amber-700 hover:underline dark:text-amber-300" @click="emit('revealSpan', d.span)">
          L{{ d.span.line }}: {{ truncateDiagnostic(d.message) }}
        </button>
      </li>
    </ul>
  </div>
</template>
