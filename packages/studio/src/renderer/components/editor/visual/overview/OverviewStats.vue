<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary } from '../../../../preload/index'
import IconActionButton from '../../../ui/IconActionButton.vue'
import SectionCard from '../ui/SectionCard.vue'

const props = defineProps<{
  module: VisualModuleSummary
  disabled?: boolean
}>()

const emit = defineEmits<{
  create: [kind: 'type' | 'var' | 'inv' | 'process']
}>()

const { t } = useI18n()

const health = computed(() => {
  const n = Math.max(1, props.module.processes.length)
  const ready = props.module.processes.filter((p) => (p.scenarioCount ?? 0) > 0 || p.hasFsf || p.hasPre).length
  return Math.round((100 * ready) / n)
})

const stats = computed(() => [
  { id: 'type' as const, label: t('visual.section.type'), value: props.module.typeCount },
  { id: 'var' as const, label: t('visual.section.var'), value: props.module.varCount },
  { id: 'inv' as const, label: t('visual.section.inv'), value: props.module.invCount },
  { id: 'process' as const, label: t('visual.section.processes'), value: props.module.processes.length }
])
</script>

<template>
  <SectionCard>
    <template #title>
      <h3 class="text-sm font-semibold text-content-primary">{{ t('visual.overview.title') }}</h3>
    </template>
    <div class="grid grid-cols-2 gap-2">
      <div
        v-for="stat in stats"
        :key="stat.id"
        class="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-base px-3 py-2"
      >
        <div>
          <p class="text-[11px] text-content-muted">{{ stat.label }}</p>
          <p class="text-lg font-semibold tabular-nums text-content-primary">{{ stat.value }}</p>
        </div>
        <IconActionButton
          icon="lucide:plus"
          :label="t('visual.overview.add', { kind: stat.label })"
          variant="accent"
          :disabled="disabled"
          @click="emit('create', stat.id)"
        />
      </div>
    </div>
    <p class="mt-3 text-[12px] text-content-secondary">
      {{ t('visual.specHealth') }}:
      <span class="font-medium text-content-primary">{{ health }}%</span>
    </p>
    <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-overlay">
      <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: `${health}%` }" />
    </div>
  </SectionCard>
</template>
