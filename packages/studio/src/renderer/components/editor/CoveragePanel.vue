<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CoverageReportPayload } from '../../preload/index'

const props = defineProps<{
  report: CoverageReportPayload | null
}>()

const emit = defineEmits<{
  revealInformal: [aspecId: string]
  revealHybrid: [payload: { name: string; kind: 'process' | 'function' }]
}>()

const openModel = defineModel<boolean>('open', { default: true })

const { t } = useI18n()

watch(
  () => props.report,
  (r) => {
    if (r && r.total > 0) openModel.value = true
  }
)
</script>

<template>
  <div v-if="report && report.total > 0" class="border-t border-border-subtle bg-surface-raised">
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay"
      @click="openModel = !openModel"
    >
      <span>
        {{ t('refine.coverage', { percent: report.percent, covered: report.covered, total: report.total }) }}
        <span v-if="report.stale > 0" class="ml-2 text-semantic-warning">({{ t('refine.stale') }})</span>
      </span>
      <span>{{ openModel ? '▼' : '▶' }}</span>
    </button>
    <ul v-if="openModel" class="max-h-40 overflow-y-auto studio-scroll px-3 pb-2">
      <li v-for="item in report.items" :key="item.aspecId + item.kind">
        <button
          type="button"
          class="flex w-full items-center gap-2 py-0.5 text-left text-xs hover:underline"
          @click="
            item.kind === 'process' || item.kind === 'function'
              ? emit('revealHybrid', { name: item.name, kind: item.kind })
              : emit('revealInformal', item.aspecId)
          "
        >
          <span
            class="shrink-0 rounded px-1"
            :class="{
              'bg-semantic-success/20 text-semantic-success': item.status === 'covered',
              'bg-semantic-warning/20 text-semantic-warning': item.status === 'partial' || item.status === 'stale',
              'bg-semantic-error/20 text-semantic-error': item.status === 'missing'
            }"
          >
            {{ item.status }}
          </span>
          <span class="truncate text-content-primary">{{ item.name }}</span>
          <span class="text-content-muted">({{ item.kind }})</span>
        </button>
      </li>
    </ul>
  </div>
</template>
