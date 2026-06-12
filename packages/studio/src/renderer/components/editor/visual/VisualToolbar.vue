<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TreeSelection } from '../../../composables/useVisualModel'
import type { DeclarationKind } from '../../../preload/index'
import { useEditorUiStore, type VisualSideView } from '../../../stores/editorUi'

const props = defineProps<{
  selection: TreeSelection
  parseFailed: boolean
  hasDiagnostics: boolean
  loading: boolean
  syncing?: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  refresh: []
  addDeclaration: [kind: DeclarationKind]
  addScenario: []
  addProcess: []
  addFunction: []
  renameProcess: []
  renameFunction: []
  addModule: []
  renameModule: []
  removeModule: []
  'update:searchQuery': [value: string]
}>()

const { t } = useI18n()
const editorUi = useEditorUiStore()
const addMenuOpen = ref(false)

const sideViews = computed(() => [
  { id: 'tree' as VisualSideView, label: t('toolbar.viewTree') },
  { id: 'graph' as VisualSideView, label: t('toolbar.viewGraph') }
])

const writeDisabled = computed(() => props.parseFailed || props.hasDiagnostics)

function showAddDeclaration(): boolean {
  return props.selection?.kind === 'module' && !writeDisabled.value
}

function showAddProcess(): boolean {
  return props.selection?.kind === 'module' && !writeDisabled.value
}

function showAddFunction(): boolean {
  return props.selection?.kind === 'module' && !writeDisabled.value
}

function showAddScenario(): boolean {
  return (props.selection?.kind === 'process' || props.selection?.kind === 'function') && !writeDisabled.value
}

function showRenameProcess(): boolean {
  return props.selection?.kind === 'process' && !writeDisabled.value
}

function showRenameFunction(): boolean {
  return props.selection?.kind === 'function' && !writeDisabled.value
}

function showModuleActions(): boolean {
  return props.selection?.kind === 'module' && !writeDisabled.value
}

function onZoomInput(e: Event): void {
  const v = Number.parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v)) editorUi.setGraphZoom(v)
}
</script>

<template>
  <div
    class="flex h-[36px] shrink-0 items-center gap-2 border-b border-border-subtle bg-surface-base px-3"
  >
    <div class="flex shrink-0 rounded-lg border border-border-subtle p-0.5">
      <button
        v-for="sv in sideViews"
        :key="sv.id"
        type="button"
        class="rounded-md px-2.5 py-1 text-sm transition-colors duration-150 active:scale-[0.98]"
        :class="
          editorUi.sideView === sv.id
            ? 'bg-surface-raised text-content-primary shadow-sm'
            : 'text-content-secondary hover:text-content-primary'
        "
        @click="editorUi.setSideView(sv.id)"
      >
        {{ sv.label }}
      </button>
    </div>

    <template v-if="editorUi.sideView === 'graph'">
      <label class="flex items-center gap-1 text-xs text-content-secondary">
        <span>{{ t('visual.graphZoom') }}</span>
        <input
          type="number"
          min="25"
          max="200"
          step="5"
          class="visual-field w-14 px-1 py-0.5 text-xs"
          :value="editorUi.graphZoomPercent"
          @change="onZoomInput"
        />
        <span>%</span>
      </label>
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs text-content-secondary hover:bg-surface-overlay hover:text-content-primary"
        @click="editorUi.fitGraphToView()"
      >
        {{ t('visual.graphFit') }}
      </button>
    </template>

    <input
      type="search"
      class="visual-field ml-1 max-w-[140px] flex-1 px-2 py-1 text-xs placeholder:text-content-muted"
      :placeholder="t('visual.searchPlaceholder')"
      :value="searchQuery"
      @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
    />

    <div class="flex-1" />

    <span v-if="syncing" class="text-xs text-content-secondary">{{ t('visual.syncing') }}</span>
    <button
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary disabled:opacity-40"
      :disabled="loading"
      @click="emit('refresh')"
    >
      {{ t('visual.toolbar.refresh') }}
    </button>
    <div v-if="showAddDeclaration()" class="relative">
      <button
        type="button"
        class="rounded-md px-2.5 py-1 text-sm text-accent transition-colors hover:bg-accent/10"
        @click="addMenuOpen = !addMenuOpen"
      >
        {{ t('visual.toolbar.addDeclaration') }}
      </button>
      <div
        v-if="addMenuOpen"
        class="absolute left-0 top-full z-10 mt-1 min-w-[120px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
      >
        <button
          v-for="kind in (['const', 'type', 'var'] as DeclarationKind[])"
          :key="kind"
          type="button"
          class="block w-full px-3 py-1.5 text-left text-sm text-content-primary hover:bg-surface-overlay"
          @click="emit('addDeclaration', kind); addMenuOpen = false"
        >
          {{ t(`visual.section.${kind === 'const' ? 'const' : kind}`) }}
        </button>
      </div>
    </div>
    <button
      v-if="showModuleActions()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-accent transition-colors hover:bg-accent/10"
      @click="emit('addModule')"
    >
      {{ t('visual.toolbar.addModule') }}
    </button>
    <button
      v-if="showModuleActions()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
      @click="emit('renameModule')"
    >
      {{ t('visual.toolbar.renameModule') }}
    </button>
    <button
      v-if="showModuleActions()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-semantic-error transition-colors hover:bg-semantic-error/10"
      @click="emit('removeModule')"
    >
      {{ t('visual.toolbar.removeModule') }}
    </button>
    <button
      v-if="showAddProcess()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-role-process transition-colors hover:bg-role-process/10"
      @click="emit('addProcess')"
    >
      {{ t('visual.toolbar.addProcess') }}
    </button>
    <button
      v-if="showAddFunction()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-role-function transition-colors hover:bg-role-function/10"
      @click="emit('addFunction')"
    >
      {{ t('visual.toolbar.addFunction') }}
    </button>
    <button
      v-if="showRenameProcess()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
      @click="emit('renameProcess')"
    >
      {{ t('visual.toolbar.renameProcess') }}
    </button>
    <button
      v-if="showRenameFunction()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
      @click="emit('renameFunction')"
    >
      {{ t('visual.toolbar.renameFunction') }}
    </button>
    <button
      v-if="showAddScenario()"
      type="button"
      class="rounded-md px-2.5 py-1 text-sm text-accent transition-colors hover:bg-accent/10"
      @click="emit('addScenario')"
    >
      {{ t('visual.addScenario') }}
    </button>
  </div>
</template>

