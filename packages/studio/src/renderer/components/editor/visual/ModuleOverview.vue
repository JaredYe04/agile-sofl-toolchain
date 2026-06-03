<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary } from '../../../preload/index'

defineProps<{ module: VisualModuleSummary }>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-6 p-4">
    <header>
      <h2 class="text-lg font-semibold text-content-primary">
        {{ module.isSystem ? `SYSTEM_${module.name}` : module.name }}
      </h2>
      <p v-if="module.parentName" class="text-sm text-content-secondary">
        {{ t('visual.parentModule') }}: {{ module.parentName }}
      </p>
    </header>

    <section v-if="module.consts.length">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.const') }}</h3>
      <ul class="space-y-1 rounded-lg border border-border-subtle bg-surface-base p-3 font-mono text-xs">
        <li v-for="c in module.consts" :key="c" class="text-content-secondary">{{ c }}</li>
      </ul>
    </section>

    <section v-if="module.types.length">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.type') }}</h3>
      <ul class="space-y-1 rounded-lg border border-border-subtle bg-surface-base p-3 font-mono text-xs">
        <li v-for="ty in module.types" :key="ty" class="text-content-secondary">{{ ty }}</li>
      </ul>
    </section>

    <section v-if="module.vars.length">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.var') }}</h3>
      <ul class="space-y-1 rounded-lg border border-border-subtle bg-surface-base p-3 font-mono text-xs">
        <li v-for="v in module.vars" :key="v" class="text-content-secondary">{{ v }}</li>
      </ul>
    </section>

    <section v-if="module.invCount">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.inv') }}</h3>
      <p class="text-sm text-content-secondary">{{ module.invCount }} {{ t('visual.invariantCount') }}</p>
    </section>

    <section v-if="module.processes.length">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.processes') }}</h3>
      <ul class="space-y-1 text-sm text-content-secondary">
        <li v-for="p in module.processes" :key="p.name">{{ p.name }}</li>
      </ul>
    </section>

    <section v-if="module.functions.length">
      <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">{{ t('visual.section.functions') }}</h3>
      <ul class="space-y-1 text-sm text-content-secondary">
        <li v-for="f in module.functions" :key="f">{{ f }}</li>
      </ul>
    </section>
  </div>
</template>
