<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary, DeclarationKind, SerializableSpan } from '../../../preload/index'
import type { TreeSelection } from '../../../composables/useVisualModel'
import DeclarationEditor from './DeclarationEditor.vue'
import InvariantPanel from './InvariantPanel.vue'
import HybridGuiPanel from './HybridGuiPanel.vue'
import Badge from './ui/Badge.vue'
import InlineRename from './ui/InlineRename.vue'

const props = defineProps<{ module: VisualModuleSummary; disabled?: boolean }>()
const emit = defineEmits<{
  patchDeclaration: [payload: { kind: DeclarationKind; action: 'patch' | 'add' | 'remove'; name?: string; text?: string }]
  patchInvariant: [payload: { span: SerializableSpan; text: string }]
  revealSpan: [span: SerializableSpan]
  select: [selection: TreeSelection]
  renameModule: [name: string]
  patchGuiWidget: [payload: { screenName: string; widgetName: string; text: string }]
}>()
const { t } = useI18n()
const renaming = ref(false)

const displayName = () => (props.module.isSystem ? `SYSTEM_${props.module.name}` : props.module.name)

function selectProcess(moduleName: string, processName: string): void {
  emit('select', { kind: 'process', moduleName, processName })
}

function selectFunction(moduleName: string, functionName: string): void {
  emit('select', { kind: 'function', moduleName, functionName })
}
</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header>
      <h2 class="flex min-w-0 items-center gap-2 text-lg font-semibold text-content-primary">
        <InlineRename
          :model-value="displayName()"
          :editing="renaming"
          :disabled="disabled"
          @update:editing="renaming = $event"
          @commit="emit('renameModule', $event.replace(/^SYSTEM_/, ''))"
        />
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
      :disabled="disabled"
      @reveal-span="emit('revealSpan', $event)"
      @patch="emit('patchInvariant', $event)"
    />

    <HybridGuiPanel
      v-if="module.gui"
      :gui="module.gui"
      :module="module"
      :disabled="disabled"
      @reveal-span="emit('revealSpan', $event)"
      @patch-widget="emit('patchGuiWidget', $event)"
    />

    <section v-if="module.processes.length" class="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.processes') }}</h3>
      <ul class="space-y-1">
        <li v-for="p in module.processes" :key="p.name">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-content-primary transition-colors hover:bg-surface-overlay"
            @click="selectProcess(module.name, p.name)"
          >
            <Badge variant="process">{{ t('visual.nodeRole.process') }}</Badge>
            <Badge v-if="p.isInit" variant="neutral">{{ t('visual.init.badge') }}</Badge>
            <Badge v-if="p.isAlias" variant="neutral">{{ t('visual.alias.badge') }}</Badge>
            <Badge v-else-if="p.fsfFormal === 'formal'" variant="formal">{{ t('visual.fsfFormal') }}</Badge>
            <Badge v-else-if="p.fsfFormal === 'semi-formal'" variant="semi-formal">{{ t('visual.fsfSemiFormal') }}</Badge>
            <span>{{ p.isInit ? 'Init' : p.name }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-if="module.functions.length" class="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.functions') }}</h3>
      <ul class="space-y-1">
        <li v-for="f in module.functions" :key="f.name">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-content-primary transition-colors hover:bg-surface-overlay"
            @click="selectFunction(module.name, f.name)"
          >
            <Badge variant="function">{{ t('visual.nodeRole.function') }}</Badge>
            <Badge v-if="f.fsfFormal === 'formal'" variant="formal">{{ t('visual.fsfFormal') }}</Badge>
            <Badge v-else-if="f.fsfFormal === 'semi-formal'" variant="semi-formal">{{ t('visual.fsfSemiFormal') }}</Badge>
            <span>{{ f.name }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
