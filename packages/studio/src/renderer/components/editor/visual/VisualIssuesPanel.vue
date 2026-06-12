<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiagnosticSummary } from '../../../preload/index'
import { truncateDiagnostic } from '../../../utils/truncateDiagnostic'

type SeverityFilter = 'all' | 'error' | 'warning' | 'info'

const props = defineProps<{
  diagnostics: DiagnosticSummary[]
  open: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: DiagnosticSummary['span']]
  'update:open': [value: boolean]
}>()

const { t } = useI18n()
const filter = ref<SeverityFilter>('all')

const counts = computed(() => ({
  error: props.diagnostics.filter((d) => d.severity === 'error').length,
  warning: props.diagnostics.filter((d) => d.severity === 'warning').length,
  info: props.diagnostics.filter((d) => d.severity === 'info').length
}))

const filtered = computed(() => {
  const list =
    filter.value === 'all'
      ? props.diagnostics
      : props.diagnostics.filter((d) => d.severity === filter.value)
  return list.slice(0, 50)
})

const hasAny = computed(() => props.diagnostics.length > 0)

function severityClass(severity: string): string {
  if (severity === 'error') return 'text-semantic-error'
  if (severity === 'warning') return 'text-semantic-warning'
  return 'text-content-secondary'
}

function sourceLabel(source?: string): string {
  if (source === 'lsp') return t('visual.issues.source.lsp')
  if (source === 'fsf') return t('visual.issues.source.fsf')
  return t('visual.issues.source.parse')
}

const filters: SeverityFilter[] = ['all', 'error', 'warning', 'info']
</script>

<template>
  <div
    v-if="hasAny"
    class="studio-text-selectable shrink-0 border-t border-border-subtle bg-surface-raised"
    :class="open ? 'max-h-44' : 'max-h-9'"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-content-secondary">
      <button
        type="button"
        class="hover:text-content-primary"
        @click="emit('update:open', !open)"
      >
        {{ t('visual.issues.title', { count: diagnostics.length }) }}
        <span class="ml-1 opacity-60">{{ open ? '▾' : '▸' }}</span>
      </button>
      <div v-if="open" class="flex items-center gap-1">
        <button
          v-for="f in filters"
          :key="f"
          type="button"
          class="rounded px-1.5 py-0.5 capitalize transition-colors"
          :class="filter === f ? 'bg-accent/15 text-accent' : 'hover:bg-surface-overlay'"
          @click="filter = f"
        >
          {{ t(`visual.issues.filter.${f}`) }}
          <span v-if="f !== 'all' && counts[f as keyof typeof counts]" class="ml-0.5 opacity-70">
            ({{ counts[f as keyof typeof counts] }})
          </span>
        </button>
        <button type="button" class="ml-1 hover:text-content-primary" @click="emit('update:open', false)">
          {{ t('visual.issues.close') }}
        </button>
      </div>
    </div>
    <ul v-if="open" class="max-h-32 space-y-0.5 overflow-y-auto px-3 pb-2 text-xs">
      <li v-for="(d, i) in filtered" :key="i">
        <button
          type="button"
          class="text-left hover:underline"
          :class="severityClass(d.severity)"
          @click="emit('revealSpan', d.span)"
        >
          <span class="uppercase opacity-60">{{ d.severity }}</span>
          <span class="rounded bg-surface-overlay px-1 opacity-70">{{ sourceLabel(d.source) }}</span>
          L{{ d.span.line }}: {{ truncateDiagnostic(d.message) }}
        </button>
      </li>
    </ul>
  </div>
</template>
