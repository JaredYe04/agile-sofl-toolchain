<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary } from '../../../preload/index'
import type { TreeSelection } from '../../../composables/useVisualModel'

defineProps<{
  modules: VisualModuleSummary[]
  selected: TreeSelection
}>()

const emit = defineEmits<{ select: [selection: TreeSelection] }>()
const { t } = useI18n()

function selectModule(name: string): void {
  emit('select', { kind: 'module', moduleName: name })
}

function selectProcess(moduleName: string, processName: string): void {
  emit('select', { kind: 'process', moduleName, processName })
}

function selectFunction(moduleName: string, functionName: string): void {
  emit('select', { kind: 'function', moduleName, functionName })
}
</script>

<template>
  <nav class="h-full w-52 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-base p-2 text-sm">
    <p v-if="!modules.length" class="px-2 py-1 text-content-muted">{{ t('visual.noModules') }}</p>
    <ul v-for="mod in modules" :key="mod.name" class="mb-2">
      <li>
        <button
          type="button"
          class="w-full rounded-md px-2 py-1 text-left font-medium transition-colors duration-150"
          :class="
            selected?.kind === 'module' && selected.moduleName === mod.name
              ? 'bg-accent/15 text-accent'
              : 'text-content-primary hover:bg-surface-overlay'
          "
          @click="selectModule(mod.name)"
        >
          {{ mod.isSystem ? `SYSTEM_${mod.name}` : mod.name }}
        </button>
        <ul class="ml-2 mt-0.5 space-y-0.5 border-l border-border-subtle pl-2">
          <li v-if="mod.constCount" class="px-2 py-0.5 text-xs text-content-muted">
            {{ t('visual.section.const') }} ({{ mod.constCount }})
          </li>
          <li v-if="mod.typeCount" class="px-2 py-0.5 text-xs text-content-muted">
            {{ t('visual.section.type') }} ({{ mod.typeCount }})
          </li>
          <li v-if="mod.varCount" class="px-2 py-0.5 text-xs text-content-muted">
            {{ t('visual.section.var') }} ({{ mod.varCount }})
          </li>
          <li v-if="mod.invCount" class="px-2 py-0.5 text-xs text-content-muted">
            {{ t('visual.section.inv') }} ({{ mod.invCount }})
          </li>
          <li v-for="proc in mod.processes" :key="proc.name">
            <button
              type="button"
              class="w-full rounded px-2 py-0.5 text-left transition-colors duration-150"
              :class="
                selected?.kind === 'process' &&
                selected.moduleName === mod.name &&
                selected.processName === proc.name
                  ? 'bg-accent/15 text-accent'
                  : 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary'
              "
              @click="selectProcess(mod.name, proc.name)"
            >
              {{ t('visual.process') }} {{ proc.name }}
            </button>
          </li>
          <li v-for="fn in mod.functions" :key="fn">
            <button
              type="button"
              class="w-full rounded px-2 py-0.5 text-left transition-colors duration-150"
              :class="
                selected?.kind === 'function' &&
                selected.moduleName === mod.name &&
                selected.functionName === fn
                  ? 'bg-accent/15 text-accent'
                  : 'text-content-secondary hover:bg-surface-overlay hover:text-content-primary'
              "
              @click="selectFunction(mod.name, fn)"
            >
              {{ t('visual.function') }} {{ fn }}
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
