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
const open = ref<Record<string, boolean>>({})

function toggle(name: string): void {
  open.value = { ...open.value, [name]: open.value[name] === false }
}

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
      <div class="mt-3 grid grid-cols-2 gap-2 text-[12px] text-content-secondary sm:grid-cols-4">
        <p>{{ t('visual.section.type') }} {{ module.typeCount }}</p>
        <p>{{ t('visual.section.var') }} {{ module.varCount }}</p>
        <p>{{ t('visual.section.inv') }} {{ module.invCount }}</p>
        <p>{{ t('visual.section.processes') }} {{ module.processes.length }}</p>
      </div>
      <p class="mt-2 text-[12px] text-content-secondary">
        {{ t('visual.specHealth') }}:
        {{
          Math.round(
            (100 *
              module.processes.filter((p) => (p.scenarioCount ?? 0) > 0 || p.hasFsf || p.hasPre).length) /
              Math.max(1, module.processes.length)
          )
        }}%
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

    <section v-if="module.processes.length" class="space-y-2">
      <h3 class="text-sm font-semibold text-content-primary">{{ t('visual.section.processes') }}</h3>
      <article
        v-for="p in module.processes"
        :key="p.name"
        class="rounded-lg border border-border-subtle bg-surface-raised p-3"
      >
        <div class="flex w-full items-center gap-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-content-primary"
            @click="toggle(p.name)"
          >
            <span class="text-content-muted">{{ open[p.name] === false ? '▶' : '▼' }}</span>
            <Badge variant="process">{{ t('visual.nodeRole.process') }}</Badge>
            <span class="flex-1 truncate">{{ p.isInit ? 'Init' : p.name }}</span>
            <Badge v-if="p.formalizationStatus === 'formal'" variant="formal">{{ t('visual.status.formal') }}</Badge>
            <Badge v-else variant="semi-formal">{{ t('visual.status.semiFormal') }}</Badge>
          </button>
          <button
            type="button"
            class="shrink-0 rounded-md px-2 py-0.5 text-[11px] text-accent hover:bg-accent/10"
            @click="selectProcess(module.name, p.name)"
          >
            {{ t('visual.editProcess') }}
          </button>
        </div>
        <div v-show="open[p.name] !== false" class="mt-2 space-y-2 pl-5 text-[12px] text-content-secondary">
          <div v-if="p.inputs?.length">
            <p class="font-medium text-content-muted">{{ t('visual.input') }}</p>
            <p v-for="g in p.inputs" :key="g.names">{{ g.names }}: {{ g.type }}</p>
          </div>
          <div v-if="p.outputs?.length">
            <p class="font-medium text-content-muted">{{ t('visual.output') }}</p>
            <p v-for="g in p.outputs" :key="g.names">{{ g.names }}: {{ g.type }}</p>
          </div>
          <p v-if="p.comment" class="whitespace-pre-wrap">{{ p.comment }}</p>
          <p v-if="p.pre">{{ t('visual.pre') }}: {{ p.pre }}</p>
          <p>{{ t('visual.scenarios') }}: {{ p.scenarioCount ?? 0 }} · {{ t('visual.exceptionalScenarios') }}: {{ p.exceptionalCount ?? 0 }}</p>
        </div>
      </article>
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
