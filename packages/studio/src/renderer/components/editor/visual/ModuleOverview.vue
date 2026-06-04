<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary } from '../../../preload/index'
import type { DeclarationKind } from '../../../preload/index'
import DeclarationEditor from './DeclarationEditor.vue'
import InvariantPanel from './InvariantPanel.vue'
import type { SerializableSpan } from '../../../preload/index'

defineProps<{ module: VisualModuleSummary; disabled?: boolean }>()
const emit = defineEmits<{
  patchDeclaration: [payload: { kind: DeclarationKind; action: 'patch' | 'add' | 'remove'; name?: string; text?: string }]
  revealSpan: [span: SerializableSpan]
}>()
const { t } = useI18n()
</script>

<template>
  <div class="visual-panel space-y-6 p-4">
    <header>
      <h2 class="text-lg font-semibold text-content-primary">
        {{ module.isSystem ? `SYSTEM_${module.name}` : module.name }}
      </h2>
      <p v-if="module.parentName" class="text-sm text-content-secondary">
        {{ t('visual.parentModule') }}: {{ module.parentName }}
      </p>
    </header>

    <DeclarationEditor
      kind="const"
      :items="module.consts"
      :module-name="module.name"
      :disabled="disabled"
      @patch="emit('patchDeclaration', $event)"
      @reveal-span="emit('revealSpan', $event)"
    />
    <DeclarationEditor
      kind="type"
      :items="module.types"
      :module-name="module.name"
      :disabled="disabled"
      @patch="emit('patchDeclaration', $event)"
      @reveal-span="emit('revealSpan', $event)"
    />
    <DeclarationEditor
      kind="var"
      :items="module.vars"
      :module-name="module.name"
      :disabled="disabled"
      @patch="emit('patchDeclaration', $event)"
      @reveal-span="emit('revealSpan', $event)"
    />

    <InvariantPanel
      v-if="module.invariants?.length"
      :invariants="module.invariants"
      @reveal-span="emit('revealSpan', $event)"
    />

    <section v-if="module.processes.length">
      <h3 class="mb-2 text-sm font-medium text-content-secondary">{{ t('visual.section.processes') }}</h3>
      <ul class="space-y-1 text-sm text-content-primary">
        <li v-for="p in module.processes" :key="p.name">{{ p.name }}</li>
      </ul>
    </section>

    <section v-if="module.functions.length">
      <h3 class="mb-2 text-sm font-medium text-content-secondary">{{ t('visual.section.functions') }}</h3>
      <ul class="space-y-1 text-sm text-content-primary">
        <li v-for="f in module.functions" :key="f.name">{{ f.name }}</li>
      </ul>
    </section>
  </div>
</template>
