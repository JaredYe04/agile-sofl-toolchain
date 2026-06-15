<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeclarationKind, SerializableSpan, DiagnosticSummary, VisualModuleSummary } from '../../../preload/index'
import { useDocumentStore } from '../../../stores/document'
import { useEditorUiStore } from '../../../stores/editorUi'
import { useLinkedInformalHints } from '../../../composables/useLinkedInformalHints'
import { useEditorSelectionStore } from '../../../stores/editorSelection'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { VISUAL_MODEL_KEY } from '../../../composables/visualModelContext'
import type { VisualActionType } from '../../../composables/visualActions'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import ParseErrorBanner from './ParseErrorBanner.vue'
import VisualToolbar from './VisualToolbar.vue'
import VisualContextMenu from './VisualContextMenu.vue'
import ModuleTree from './ModuleTree.vue'
import ModuleGraphView from './ModuleGraphView.vue'
import ModuleOverview from './ModuleOverview.vue'
import ProcessEditor from './ProcessEditor.vue'
import FunctionEditor from './FunctionEditor.vue'
import AliasProcessEditor from './AliasProcessEditor.vue'
import { useModalStore } from '../../../stores/modal'
import ResizableSplit from '../../ui/ResizableSplit.vue'
import type { SymbolHint } from './predicate/predicateTypes'
import type { ProcessNodeMeta } from '@agile-sofl/editor-api'

const PREDICATE_KEYWORDS: SymbolHint[] = [
  { label: 'and', kind: 'keyword' },
  { label: 'or', kind: 'keyword' },
  { label: 'not', kind: 'keyword' },
  { label: 'true', kind: 'keyword' },
  { label: 'false', kind: 'keyword' },
  { label: 'forall', kind: 'keyword' },
  { label: 'exists', kind: 'keyword' }
]

const emit = defineEmits<{ revealSpan: [span: SerializableSpan] }>()

const { t } = useI18n()
const modal = useModalStore()
const doc = useDocumentStore()
const editorUi = useEditorUiStore()
const linkedHints = useLinkedInformalHints(computed(() => doc.activeTabId))
const editorSelection = useEditorSelectionStore()
const selected = ref<TreeSelection>(null)
const processEditorRef = ref<InstanceType<typeof ProcessEditor> | null>(null)
const functionEditorRef = ref<InstanceType<typeof FunctionEditor> | null>(null)
const searchQuery = ref('')
const contextMenu = ref<{ x: number; y: number; selection: TreeSelection } | null>(null)

const visual = inject(VISUAL_MODEL_KEY)
if (!visual) throw new Error('VisualEditor requires VISUAL_MODEL_KEY provider')

const modules = computed(() => visual.model.value?.modules ?? [])
const diagnostics = computed(
  () => (visual.model.value?.diagnostics ?? []) as DiagnosticSummary[]
)

watch(selected, (value) => {
  editorSelection.setSelection(value)
}, { immediate: true })

const writeDisabled = computed(
  () => visual.parseFailed.value || visual.hasDiagnostics.value
)

const writeDisabledReason = computed<'parseFailed' | 'diagnostics' | null>(() => {
  if (visual.parseFailed.value) return 'parseFailed'
  if (visual.hasDiagnostics.value) return 'diagnostics'
  return null
})

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
  return (visual.fsfModels.value as FsfModelDto[]).find((m) => m.processName === name && !m.functionName) ?? null
})

const selectedFunctionFsfModel = computed(() => {
  if (selected.value?.kind !== 'function') return null
  const sel = selected.value
  return (visual.fsfModels.value as FsfModelDto[]).find(
    (m) => m.functionName === sel.functionName && m.moduleName === sel.moduleName
  ) ?? null
})

const symbolHints = computed((): SymbolHint[] => {
  const mod = selectedModule.value
  if (!mod) return PREDICATE_KEYWORDS
  return [
    ...mod.consts.map((c) => ({ label: c.name, kind: 'const' as const })),
    ...mod.types.map((t) => ({ label: t.name, kind: 'type' as const })),
    ...mod.vars.map((v) => ({ label: v.name, kind: 'var' as const })),
    ...PREDICATE_KEYWORDS
  ]
})

const graphProcessMeta = computed((): Record<string, ProcessNodeMeta> => {
  const meta: Record<string, ProcessNodeMeta> = {}
  for (const mod of modules.value) {
    for (const p of mod.processes) {
      meta[`${mod.name}::process::${p.name}`] = {
        isInit: p.isInit,
        isAlias: p.isAlias,
        aliasTarget: p.aliasTarget,
        hasExt: (p.ext?.length ?? 0) > 0
      }
    }
  }
  return meta
})

const graphHints = computed((): Record<string, string> => {
  const hints: Record<string, string> = {}
  for (const mod of modules.value) {
    for (const p of mod.processes) {
      const lines: string[] = []
      const comment = p.comment?.replace(/^comment:\s*/i, '').trim()
      const decom = p.decom?.replace(/^decom:\s*/i, '').trim()
      if (comment) lines.push(comment)
      if (decom) lines.push(`decom: ${decom}`)
      if (lines.length) hints[`${mod.name}::process::${p.name}`] = lines.join('\n')
    }
    for (const f of mod.functions) {
      const summary = f.text.split('\n').slice(0, 2).join(' ').trim()
      if (summary) hints[`${mod.name}::function::${f.name}`] = summary
    }
  }
  return hints
})

const selectedProcess = computed(() => {
  if (selected.value?.kind !== 'process' || !selectedModule.value) return null
  return selectedModule.value.processes.find((p) => p.name === selected.value!.processName) ?? null
})

const selectedFunction = computed(() => {
  if (selected.value?.kind !== 'function' || !selectedModule.value) return null
  return selectedModule.value.functions.find((f) => f.name === selected.value!.functionName) ?? null
})

const blockInformalPredicate = computed(() => {
  if (!editorUi.fsfStrictMode || selected.value?.kind !== 'process') return false
  const proc = selectedProcess.value
  if (!proc) return false
  return linkedHints.blockInformalForProcess(
    selected.value.processName,
    Boolean(proc.decom?.trim()),
    true
  )
})

const blockInformalFunction = computed(() => editorUi.fsfStrictMode && selected.value?.kind === 'function')

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

function revealDecomInSource(moduleName: string, processName: string): void {
  const mod = modules.value.find((m) => m.name === moduleName)
  const proc = mod?.processes.find((p) => p.name === processName)
  if (!proc?.span) return
  const source = doc.activeTab?.content ?? ''
  const searchFrom = Math.max(0, proc.span.start - 20)
  const decomIdx = source.indexOf('decom:', searchFrom)
  if (decomIdx >= 0 && decomIdx <= proc.span.end + 80) {
    const end = Math.min(source.length, decomIdx + 48)
    emit('revealSpan', {
      start: decomIdx,
      end,
      line: proc.span.line,
      column: proc.span.column
    })
    return
  }
  emit('revealSpan', proc.span)
}

function revealForSelection(sel: TreeSelection): void {
  const mod = modules.value.find((m) => m.name === sel.moduleName)
  if (!mod) return
  if (sel.kind === 'process') {
    const proc = mod.processes.find((p) => p.name === sel.processName)
    if (proc?.span) emit('revealSpan', proc.span)
  } else if (sel.kind === 'function') {
    const fn = mod.functions.find((f) => f.name === sel.functionName)
    if (fn?.span) emit('revealSpan', fn.span)
  } else if (sel.kind === 'module') {
    const graphNode = visual.moduleGraph.value?.nodes.find(
      (n) => n.id === sel.moduleName && n.kind === 'module'
    )
    const span = mod.span ?? graphNode?.span
    if (span) emit('revealSpan', span)
    else if (mod.consts[0]?.span) emit('revealSpan', mod.consts[0].span)
  }
}

watch(selected, (sel) => {
  if (sel) revealForSelection(sel)
})

async function onPatch(payload: Parameters<NonNullable<typeof window.studio>['patchDocument']>[0]): Promise<void> {
  if (writeDisabled.value) return
  const key = `${payload.kind}:${payload.processName}`
  visual.scheduleVisualPatch(key, async (source) => {
    return window.studio!.patchDocument({ ...payload, source })
  })
}

function onPatchFunction(payload: {
  body?: string
  fsf?: { scenarios: FsfModelDto['scenarios']; others?: string }
}): void {
  if (writeDisabled.value || selected.value?.kind !== 'function') return
  visual.patchFunction({
    moduleName: selected.value.moduleName,
    name: selected.value.functionName,
    ...payload
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
  newName?: string
  template?: string
}): Promise<void> {
  if (writeDisabled.value) return
  const moduleName = selectedModule.value?.name
  if (!moduleName) return
  await visual.patchProcess({ moduleName, ...payload })
  if (payload.action === 'rename' && payload.newName) {
    if (payload.kind === 'process') {
      selected.value = { kind: 'process', moduleName, processName: payload.newName }
    } else {
      selected.value = { kind: 'function', moduleName, functionName: payload.newName }
    }
  }
}

async function onPatchInvariant(payload: { span: SerializableSpan; text: string }): Promise<void> {
  if (writeDisabled.value) return
  await visual.patchInvariant(payload)
}

async function onRenameProcess(name?: string): Promise<void> {
  if (selected.value?.kind !== 'process') return
  let newName = name
  if (!newName) {
    const { index, value } = await modal.show({
      title: t('visual.renamePrompt'),
      input: true,
      inputValue: selected.value.processName,
      buttons: [t('dialog.ok'), t('dialog.cancel')]
    })
    if (index !== 0 || !value || value === selected.value.processName) return
    newName = value
  }
  await onPatchProcess({
    kind: 'process',
    action: 'rename',
    name: selected.value.processName,
    newName
  })
}

async function onRenameFunction(name?: string): Promise<void> {
  if (selected.value?.kind !== 'function') return
  let newName = name
  if (!newName) {
    const { index, value } = await modal.show({
      title: t('visual.renamePrompt'),
      input: true,
      inputValue: selected.value.functionName,
      buttons: [t('dialog.ok'), t('dialog.cancel')]
    })
    if (index !== 0 || !value || value === selected.value.functionName) return
    newName = value
  }
  await onPatchProcess({
    kind: 'function',
    action: 'rename',
    name: selected.value.functionName,
    newName
  })
}

async function onAddModule(): Promise<void> {
  if (writeDisabled.value || !selectedModule.value) return
  const parentName = selected.value?.kind === 'module' ? selectedModule.value.name : undefined
  const { index, value, checked } = await modal.show({
    title: t('visual.module.addTitle'),
    input: true,
    inputPlaceholder: t('visual.module.namePlaceholder'),
    checkbox: true,
    checkboxLabel: t('visual.module.systemModule'),
    buttons: [t('dialog.ok'), t('dialog.cancel')]
  })
  if (index !== 0 || !value?.trim()) return
  await visual.patchModule({
    action: 'add',
    moduleName: value.trim(),
    parentName,
    isSystem: checked
  })
  selected.value = { kind: 'module', moduleName: value.trim() }
}

async function onRenameModuleInline(name: string): Promise<void> {
  if (writeDisabled.value || selected.value?.kind !== 'module') return
  const bare = name.replace(/^SYSTEM_/, '').trim()
  if (!bare || bare === selected.value.moduleName) return
  await visual.patchModule({
    action: 'rename',
    moduleName: selected.value.moduleName,
    newName: bare
  })
  selected.value = { kind: 'module', moduleName: bare }
}

function onPatchProcessInit(isInit: boolean): void {
  if (writeDisabled.value || selected.value?.kind !== 'process') return
  void visual.patchProcessInit({
    moduleName: selected.value.moduleName,
    processName: selected.value.processName,
    isInit,
    fallbackName: selected.value.processName === 'Init' ? 'P' : selected.value.processName
  })
  if (isInit) {
    selected.value = { ...selected.value, processName: 'Init' }
  }
}

async function onRenameModule(): Promise<void> {
  if (writeDisabled.value || selected.value?.kind !== 'module') return
  const { index, value } = await modal.show({
    title: t('visual.module.renameTitle'),
    input: true,
    inputValue: selected.value.moduleName,
    buttons: [t('dialog.ok'), t('dialog.cancel')]
  })
  if (index !== 0 || !value?.trim() || value.trim() === selected.value.moduleName) return
  await visual.patchModule({
    action: 'rename',
    moduleName: selected.value.moduleName,
    newName: value.trim()
  })
  selected.value = { kind: 'module', moduleName: value.trim() }
}

async function onRemoveModule(): Promise<void> {
  if (writeDisabled.value || selected.value?.kind !== 'module') return
  const { index } = await modal.show({
    title: t('visual.module.removeTitle'),
    message: t('visual.module.removeMessage', { name: selected.value.moduleName }),
    buttons: [t('dialog.delete'), t('dialog.cancel')]
  })
  if (index !== 0) return
  const moduleName = selected.value.moduleName
  await visual.patchModule({ action: 'remove', moduleName })
  const list = modules.value.filter((m) => m.name !== moduleName)
  selected.value = list[0] ? { kind: 'module', moduleName: list[0].name } : null
}

function onPatchExt(vars: import('../../../preload/index').ExtVarItem[]): void {
  if (writeDisabled.value || selected.value?.kind !== 'process') return
  void visual.patchExt({
    moduleName: selected.value.moduleName,
    processName: selected.value.processName,
    vars
  })
}

function onPatchProcessSignature(signature: string): void {
  if (writeDisabled.value || selected.value?.kind !== 'process') return
  void visual.patchProcessSignature({
    moduleName: selected.value.moduleName,
    processName: selected.value.processName,
    signature
  })
}

function onPatchFunctionSignature(signature: string): void {
  if (writeDisabled.value || selected.value?.kind !== 'function') return
  void visual.patchFunctionSignature({
    moduleName: selected.value.moduleName,
    functionName: selected.value.functionName,
    signature
  })
}

function onPatchAlias(target: string): void {
  if (writeDisabled.value || selected.value?.kind !== 'process') return
  void visual.patchAlias({
    moduleName: selected.value.moduleName,
    processName: selected.value.processName,
    aliasTarget: target
  })
}

function onAddDeclaration(kind: DeclarationKind): void {
  void onPatchDeclaration({ kind, action: 'add' })
}

async function onAddProcess(): Promise<void> {
  if (writeDisabled.value || !selectedModule.value) return
  const defaultName = `Process${(selectedModule.value.processes.length ?? 0) + 1}`
  const { index, value, checked } = await modal.show({
    title: t('visual.process.addTitle'),
    input: true,
    inputValue: defaultName,
    inputPlaceholder: t('visual.process.namePlaceholder'),
    checkbox: true,
    checkboxLabel: t('visual.process.initProcess'),
    buttons: [t('dialog.ok'), t('dialog.cancel')]
  })
  if (index !== 0) return
  const processName = checked ? 'Init' : (value?.trim() || defaultName)
  const template = checked
    ? `process Init ()\nFSF :\nothers && true\nend_process`
    : undefined
  await onPatchProcess({ kind: 'process', action: 'add', name: processName, template })
  selected.value = { kind: 'process', moduleName: selectedModule.value.name, processName }
}

function onAddFunction(): void {
  const name = `fn${(selectedModule.value?.functions.length ?? 0) + 1}`
  void onPatchProcess({ kind: 'function', action: 'add', name })
}

function onAddScenario(): void {
  if (selected.value?.kind === 'process') processEditorRef.value?.addScenario()
  else if (selected.value?.kind === 'function') functionEditorRef.value?.addScenario()
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
      if (sel.kind === 'process') selected.value = sel
      break
    case 'renameProcess':
      void onRenameProcess()
      break
    case 'renameFunction':
      void onRenameFunction()
      break
    case 'addModule':
      void onAddModule()
      break
    case 'renameModule':
      void onRenameModule()
      break
    case 'removeModule':
      void onRemoveModule()
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
      :syncing="visual.syncing.value"
      :search-query="searchQuery"
      @update:search-query="searchQuery = $event"
      @refresh="visual.rebuildNow()"
      @add-declaration="onAddDeclaration"
      @add-process="onAddProcess"
      @add-function="onAddFunction"
      @add-scenario="onAddScenario"
      @rename-process="onRenameProcess()"
      @rename-function="onRenameFunction()"
      @add-module="onAddModule"
      @rename-module="onRenameModule"
      @remove-module="onRemoveModule"
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
          :node-hints="graphHints"
          :process-meta="graphProcessMeta"
          @select="selected = $event"
          @reveal-decom="revealDecomInSource($event.moduleName, $event.processName)"
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
            @patch-invariant="onPatchInvariant"
            @rename-module="onRenameModuleInline"
            @select="selected = $event"
            @reveal-span="emit('revealSpan', $event)"
          />
          <AliasProcessEditor
            v-else-if="selected?.kind === 'process' && selectedProcess?.isAlias"
            :key="detailPanelKey"
            :process="selectedProcess"
            :disabled="writeDisabled"
            :write-disabled-reason="writeDisabledReason"
            @patch-alias="onPatchAlias"
            @rename="onRenameProcess"
          />
          <ProcessEditor
            v-else-if="selected?.kind === 'process' && selectedProcess"
            :key="detailPanelKey"
            ref="processEditorRef"
            :process="selectedProcess"
            :process-name="selected.processName"
            :module-name="selected.moduleName"
            :initial-decom="selectedProcess.decom"
            :initial-comment="selectedProcess.comment"
            :fsf-model="selectedFsfModel"
            :symbols="symbolHints"
            :disabled="writeDisabled"
            :write-disabled-reason="writeDisabledReason"
            :block-informal="blockInformalPredicate"
            @patch="onPatch"
            @patch-ext="onPatchExt"
            @patch-signature="onPatchProcessSignature"
            @patch-init="onPatchProcessInit"
            @rename="onRenameProcess"
          />
          <FunctionEditor
            v-else-if="selected?.kind === 'function' && selectedFunction"
            :key="detailPanelKey"
            ref="functionEditorRef"
            :fn="selectedFunction"
            :module-name="selected.moduleName"
            :fsf-model="selectedFunctionFsfModel"
            :symbols="symbolHints"
            :disabled="writeDisabled"
            :write-disabled-reason="writeDisabledReason"
            :block-informal="blockInformalFunction"
            @patch="onPatchFunction"
            @patch-signature="onPatchFunctionSignature"
            @rename="onRenameFunction"
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
