<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeclarationKind, SerializableSpan, DiagnosticSummary, VisualModuleSummary } from '../../../preload/index'
import { useDocumentStore } from '../../../stores/document'
import { useEditorUiStore } from '../../../stores/editorUi'
import { useVisualModel, type TreeSelection } from '../../../composables/useVisualModel'
import type { VisualActionType } from '../../../composables/visualActions'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import ParseErrorBanner from './ParseErrorBanner.vue'
import VisualIssuesPanel from './VisualIssuesPanel.vue'
import VisualToolbar from './VisualToolbar.vue'
import VisualContextMenu from './VisualContextMenu.vue'
import ModuleTree from './ModuleTree.vue'
import ModuleGraphView from './ModuleGraphView.vue'
import ModuleOverview from './ModuleOverview.vue'
import ProcessEditor from './ProcessEditor.vue'
import FunctionOverview from './FunctionOverview.vue'
import ResizableSplit from '../../ui/ResizableSplit.vue'

const emit = defineEmits<{ revealSpan: [span: SerializableSpan] }>()

const { t } = useI18n()
const doc = useDocumentStore()
const editorUi = useEditorUiStore()
const selected = ref<TreeSelection>(null)
const processEditorRef = ref<InstanceType<typeof ProcessEditor> | null>(null)
const searchQuery = ref('')
const issuesOpen = ref(false)
const contextMenu = ref<{ x: number; y: number; selection: TreeSelection } | null>(null)

const visual = useVisualModel(computed(() => doc.activeTabId))

const modules = computed(() => visual.model.value?.modules ?? [])
const diagnostics = computed(
  () => (visual.model.value?.diagnostics ?? []) as DiagnosticSummary[]
)

const writeDisabled = computed(
  () => visual.parseFailed.value || visual.hasDiagnostics.value
)

watch(
  () => visual.hasDiagnostics.value,
  (has) => {
    if (has) issuesOpen.value = true
  }
)

function selectionStillValid(sel: TreeSelection, list: VisualModuleSummary[]): boolean {
  if (!sel) return false
  const mod = list.find((m) => m.name === sel.moduleName)
  if (!mod) return false
  if (sel.kind === 'module') return true
  if (sel.kind === 'process') return mod.processes.some((p) => p.name === sel.processName)
  if (sel.kind === 'function') return mod.functions.some((f) => f.name === sel.functionName)
  return false
}

watch(modules, (list) => {
  if (!list.length) {
    selected.value = null
    return
  }
  if (!selected.value || !selectionStillValid(selected.value, list)) {
    selected.value = { kind: 'module', moduleName: list[0].name }
  }
})

const selectedModule = computed(() =>
  selected.value ? modules.value.find((m) => m.name === selected.value!.moduleName) ?? null : null
)

const selectedFsfModel = computed(() => {
  if (selected.value?.kind !== 'process') return null
  const name = selected.value.processName
  return (visual.fsfModels.value as FsfModelDto[]).find((m) => m.processName === name) ?? null
})

const selectedProcess = computed(() => {
  if (selected.value?.kind !== 'process' || !selectedModule.value) return null
  return selectedModule.value.processes.find((p) => p.name === selected.value!.processName) ?? null
})

const selectedFunction = computed(() => {
  if (selected.value?.kind !== 'function' || !selectedModule.value) return null
  return selectedModule.value.functions.find((f) => f.name === selected.value!.functionName) ?? null
})

const detailPanelKey = computed(() => {
  const tabId = doc.activeTabId
  const gen = visual.modelGen.value
  const sel = selected.value
  if (!sel) return `${tabId}-${gen}-none`
  if (sel.kind === 'module') return `${tabId}-${gen}-mod-${sel.moduleName}`
  if (sel.kind === 'process') return `${tabId}-${gen}-proc-${sel.moduleName}-${sel.processName}`
  return `${tabId}-${gen}-fn-${sel.moduleName}-${sel.functionName}`
})

const breadcrumb = computed(() => {
  const sel = selected.value
  if (!sel) return ''
  const mod = selectedModule.value
  const modLabel = mod?.isSystem ? `SYSTEM_${mod.name}` : mod?.name ?? sel.moduleName
  if (sel.kind === 'module') return modLabel
  if (sel.kind === 'process') return `${modLabel} › ${sel.processName}`
  if (sel.kind === 'function') return `${modLabel} › ${sel.functionName}`
  return modLabel
})

function revealForSelection(sel: TreeSelection): void {
  const mod = modules.value.find((m) => m.name === sel.moduleName)
  if (!mod) return
  if (sel.kind === 'process') {
    const proc = mod.processes.find((p) => p.name === sel.processName)
    if (proc?.span) emit('revealSpan', proc.span)
  } else if (sel.kind === 'function') {
    const fn = mod.functions.find((f) => f.name === sel.functionName)
    if (fn?.span) emit('revealSpan', fn.span)
  } else if (mod.consts[0]?.span) {
    emit('revealSpan', mod.consts[0].span)
  }
}

watch(selected, (sel) => {
  if (sel) revealForSelection(sel)
})

async function onPatch(payload: Parameters<NonNullable<typeof window.studio>['patchDocument']>[0]): Promise<void> {
  if (writeDisabled.value) return
  await visual.applySourcePatch(async (source) => {
    return window.studio!.patchDocument({ ...payload, source })
  })
}

async function onPatchDeclaration(payload: {
  kind: DeclarationKind
  action: 'patch' | 'add' | 'remove'
  name?: string
  text?: string
}): Promise<void> {
  if (writeDisabled.value) return
  const moduleName = selectedModule.value?.name
  if (!moduleName) return
  await visual.patchDeclaration({ moduleName, ...payload })
}

async function onPatchProcess(payload: {
  kind: 'process' | 'function'
  action: 'add' | 'remove' | 'rename'
  name: string
}): Promise<void> {
  if (writeDisabled.value) return
  const moduleName = selectedModule.value?.name
  if (!moduleName) return
  await visual.patchProcess({ moduleName, ...payload })
}

function onAddDeclaration(kind: DeclarationKind): void {
  void onPatchDeclaration({ kind, action: 'add' })
}

function onAddProcess(): void {
  const name = `Process${(selectedModule.value?.processes.length ?? 0) + 1}`
  void onPatchProcess({ kind: 'process', action: 'add', name })
}

function onAddFunction(): void {
  const name = `fn${(selectedModule.value?.functions.length ?? 0) + 1}`
  void onPatchProcess({ kind: 'function', action: 'add', name })
}

function onApplyAll(): void {
  processEditorRef.value?.applyAll()
}

function onAddScenario(): void {
  processEditorRef.value?.addScenario()
}

function onNavRatioUpdate(r: number): void {
  editorUi.setVisualNavRatio(r)
}

function openContextMenu(payload: { x: number; y: number; selection: TreeSelection }): void {
  contextMenu.value = payload
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function onContextAction(type: VisualActionType, _declarationKind?: DeclarationKind): void {
  const sel = contextMenu.value?.selection ?? selected.value
  if (!sel) return
  switch (type) {
    case 'revealInCode':
      revealForSelection(sel)
      break
    case 'addProcess':
      onAddProcess()
      break
    case 'addFunction':
      onAddFunction()
      break
    case 'addDeclaration':
      onAddDeclaration('const')
      break
    case 'addScenario':
      onAddScenario()
      break
    case 'removeProcess':
      if (sel.kind === 'process') void onPatchProcess({ kind: 'process', action: 'remove', name: sel.processName })
      break
    case 'removeFunction':
      if (sel.kind === 'function') void onPatchProcess({ kind: 'function', action: 'remove', name: sel.functionName })
      break
    case 'editProcess':
      break
  }
}

function onGlobalClick(): void {
  closeContextMenu()
}

onMounted(() => document.addEventListener('click', onGlobalClick))
onUnmounted(() => document.removeEventListener('click', onGlobalClick))
</script>

<template>
  <div class="visual-panel flex h-full min-h-0 flex-col bg-surface-base">
    <ParseErrorBanner
      v-if="visual.parseFailed.value && doc.activeTab?.content?.trim()"
      :diagnostics="diagnostics"
      @reveal-span="emit('revealSpan', $event)"
    />
    <ParseErrorBanner
      v-else-if="visual.hasDiagnostics.value && !visual.parseFailed.value"
      :diagnostics="diagnostics"
      compact
      :message="t('visual.parseWarning')"
      @reveal-span="emit('revealSpan', $event)"
    />
    <VisualIssuesPanel
      v-model:open="issuesOpen"
      :diagnostics="diagnostics"
      @reveal-span="emit('revealSpan', $event)"
    />
    <div
      v-if="breadcrumb"
      class="border-b border-border-subtle px-4 py-1.5 text-xs text-content-secondary"
    >
      {{ breadcrumb }}
    </div>
    <VisualToolbar
      :selection="selected"
      :parse-failed="visual.parseFailed.value"
      :has-diagnostics="visual.hasDiagnostics.value"
      :loading="visual.loading.value"
      :search-query="searchQuery"
      @update:search-query="searchQuery = $event"
      @refresh="visual.rebuildNow()"
      @apply-all="onApplyAll"
      @add-declaration="onAddDeclaration"
      @add-process="onAddProcess"
      @add-function="onAddFunction"
      @add-scenario="onAddScenario"
    />
    <ResizableSplit
      class="min-h-0 flex-1"
      :ratio="editorUi.visualNavRatio"
      @update:ratio="onNavRatioUpdate"
    >
      <template #left>
        <ModuleTree
          v-if="editorUi.sideView === 'tree'"
          :modules="modules"
          :selected="selected"
          :search-query="searchQuery"
          :parse-failed="visual.parseFailed.value"
          :has-diagnostics="visual.hasDiagnostics.value"
          @select="selected = $event"
          @reveal-span="emit('revealSpan', $event)"
          @contextmenu="openContextMenu"
        />
        <ModuleGraphView
          v-else
          :graph="visual.moduleGraph.value as { nodes: []; edges: [] } | null"
          :selected="selected"
          :search-query="searchQuery"
          @select="selected = $event"
          @contextmenu="openContextMenu"
        />
      </template>
      <template #right>
        <div class="studio-scroll h-full min-h-0 overflow-y-auto">
          <ModuleOverview
            v-if="selected?.kind === 'module' && selectedModule"
            :key="detailPanelKey"
            :module="selectedModule"
            :disabled="writeDisabled"
            @patch-declaration="onPatchDeclaration"
            @reveal-span="emit('revealSpan', $event)"
          />
          <ProcessEditor
            v-else-if="selected?.kind === 'process' && selectedProcess"
            :key="detailPanelKey"
            ref="processEditorRef"
            :process-name="selected.processName"
            :initial-decom="selectedProcess.decom"
            :initial-comment="selectedProcess.comment"
            :fsf-model="selectedFsfModel"
            @patch="onPatch"
          />
          <FunctionOverview
            v-else-if="selected?.kind === 'function' && selectedFunction"
            :key="detailPanelKey"
            :fn="selectedFunction"
            :module-name="selected.moduleName"
            @reveal-span="emit('revealSpan', $event)"
          />
          <div v-else class="flex h-full items-center justify-center p-8 text-sm text-content-secondary">
            {{ t('visual.selectHint') }}
          </div>
        </div>
      </template>
    </ResizableSplit>
    <VisualContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :selection="contextMenu.selection"
      :parse-failed="visual.parseFailed.value"
      :has-diagnostics="visual.hasDiagnostics.value"
      @action="onContextAction"
      @close="closeContextMenu"
    />
  </div>
</template>
