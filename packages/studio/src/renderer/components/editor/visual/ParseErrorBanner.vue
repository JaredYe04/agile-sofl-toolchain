<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DiagnosticSummary } from '../../../preload/index'
import { truncateDiagnostic } from '../../../utils/truncateDiagnostic'

const props = defineProps<{
  message?: string
  diagnostics?: DiagnosticSummary[]
  compact?: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: DiagnosticSummary['span']]
}>()

const { t } = useI18n()
const expanded = ref<Record<number, boolean>>({})

const topDiagnostics = computed(() => (props.diagnostics ?? []).slice(0, 8))

function displayMessage(msg: string, index: number): string {
  if (expanded.value[index]) return msg
  return truncateDiagnostic(msg)
}

function toggleExpand(index: number): void {
  expanded.value[index] = !expanded.value[index]
}

function isTruncated(msg: string): boolean {
  return truncateDiagnostic(msg) !== msg.trim()
}
</script>

<template>
  <div
    class="studio-text-selectable border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
    role="alert"
  >
    <p>{{ message ?? t('visual.parseError') }}</p>
    <p v-if="compact" class="mt-0.5 text-xs opacity-90">{{ t('visual.parseErrorCompact') }}</p>
    <ul v-if="topDiagnostics.length" class="mt-2 space-y-1">
      <li v-for="(d, i) in topDiagnostics" :key="i" class="flex flex-wrap items-baseline gap-2">
        <button
          type="button"
          class="text-left hover:underline"
          @click="emit('revealSpan', d.span)"
        >
          L{{ d.span.line }}: {{ displayMessage(d.message, i) }}
        </button>
        <button
          v-if="isTruncated(d.message)"
          type="button"
          class="text-xs underline opacity-75"
          @click.stop="toggleExpand(i)"
        >
          {{ expanded[i] ? t('visual.diagCollapse') : t('visual.diagExpand') }}
        </button>
      </li>
    </ul>
  </div>
</template>
