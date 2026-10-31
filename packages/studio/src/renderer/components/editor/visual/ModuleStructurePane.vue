<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CdfdGraph } from '../../../lib/editorApiRenderer'
import type {
  PatchDocumentPayload,
  VisualModuleSummary
} from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import type { SymbolHint } from './predicate/predicateTypes'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { VISUAL_MODEL_KEY } from '../../../composables/visualModelContext'
import { useWorkspaceStore } from '../../../stores/workspace'
import { sameSelection } from '../../../lib/structureNav'
import { contextMenuPoint } from '../../../lib/contextMenuPoint'
import {
  constDeclText,
  nextConstName,
  nextInvariantPlaceholder,
  nextNumberedName,
  nextProcessName,
  nextTypeName,
  nextVarName
} from '../../../lib/visualNames'
import { composedTypeText, nextFieldName, varDeclText } from '../../../lib/visualDecls'
import CdfdView from './CdfdView.vue'
import ProcessEditor from './ProcessEditor.vue'
import FunctionEditor from './FunctionEditor.vue'
import DeclarationEditor from './DeclarationEditor.vue'

type EntitySelection = Exclude<TreeSelection, null>
type MenuKind = 'board' | 'entity'
type MenuState = { x: number; y: number; kind: MenuKind; selection: EntitySelection }

const PREDICATE_KEYWORDS: SymbolHint[] = [
  { label: 'and', kind: 'keyword' },
  { label: 'or', kind: 'keyword' },
  { label: 'not', kind: 'keyword' },
  { label: 'true', kind: 'keyword' },
  { label: 'false', kind: 'keyword' },
  { label: 'forall', kind: 'keyword' },
  { label: 'exists', kind: 'keyword' }
]

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY)
if (!visual) throw new Error('ModuleStructurePane requires VISUAL_MODEL_KEY provider')

const menu = ref<MenuState | null>(null)
const invDraft = ref('')
let invTimer: ReturnType<typeof setTimeout> | null = null

const moduleSummary = computed((): VisualModuleSummary | null => {
  const list = visual.model.value?.modules ?? []
  const name = workspace.selectedModuleName
  if (!name) return list[0] ?? null
  return list.find((item) => item.name === name) ?? null
})

const showCdfd = computed(
  () =>
    workspace.selection?.kind === 'cdfd' &&
    workspace.selection.moduleName === moduleSummary.value?.name
)

const cdfdGraph = computed(() => {
  const name = moduleSummary.value?.name
  const graphs = (visual.cdfdGraphs.value ?? []) as CdfdGraph[]
  if (!name) return graphs[0] ?? null
  return graphs.find((graph) => graph.moduleName === name) ?? null
})

const blocked = computed(() => visual.parseFailed.value)

const selectedProcess = computed(() => {
  const sel = workspace.selection
  const mod = moduleSummary.value
  if (!mod || sel?.kind !== 'process' || sel.moduleName !== mod.name) return null
  return mod.processes.find((item) => item.name === sel.processName) ?? null
})

const selectedFunction = computed(() => {
  const sel = workspace.selection
  const mod = moduleSummary.value
  if (!mod || sel?.kind !== 'function' || sel.moduleName !== mod.name) return null
  return mod.functions.find((item) => item.name === sel.functionName) ?? null
})

const selectedDecl = computed(() => {
  const sel = workspace.selection
  const mod = moduleSummary.value
  if (!mod || !sel || sel.moduleName !== mod.name) return null
  if (sel.kind === 'type') return { kind: 'type' as const, items: mod.types.filter((item) => item.name === sel.name) }
  if (sel.kind === 'var') return { kind: 'var' as const, items: mod.vars.filter((item) => item.name === sel.name) }
  if (sel.kind === 'const') return { kind: 'const' as const, items: mod.consts.filter((item) => item.name === sel.name) }
  return null
})

const selectedInv = computed(() => {
  const sel = workspace.selection
  const mod = moduleSummary.value
  if (!mod || sel?.kind !== 'inv' || sel.moduleName !== mod.name) return null
  return mod.invariants[sel.index] ?? null
})

watch(
  () => selectedInv.value?.text ?? '',
  (text) => {
    if (text !== invDraft.value) invDraft.value = text
  },
  { immediate: true }
)

const processFsf = computed(() => {
  const proc = selectedProcess.value
  if (!proc) return null
  return (
    (visual.fsfModels.value as FsfModelDto[]).find((item) => item.processName === proc.name && !item.functionName) ??
    null
  )
})

const functionFsf = computed(() => {
  const fn = selectedFunction.value
  const mod = moduleSummary.value
  if (!fn || !mod) return null
  return (
    (visual.fsfModels.value as FsfModelDto[]).find(
      (item) => item.functionName === fn.name && item.moduleName === mod.name
    ) ?? null
  )
})

const symbolHints = computed((): SymbolHint[] => {
  const mod = moduleSummary.value
  if (!mod) return PREDICATE_KEYWORDS
  return [
    ...mod.consts.map((item) => ({ label: item.name, kind: 'const' as const })),
    ...mod.types.map((item) => ({ label: item.name, kind: 'type' as const })),
    ...mod.vars.map((item) => ({ label: item.name, kind: 'var' as const })),
    ...PREDICATE_KEYWORDS
  ]
})

const sections = computed(() => {
  const mod = moduleSummary.value
  if (!mod) return []
  const chip = (selection: EntitySelection, label: string) => ({ selection, label })
  return [
    {
      key: 'types',
      title: t('visual.section.type'),
      chips: mod.types.map((item) => chip({ kind: 'type', moduleName: mod.name, name: item.name }, item.name))
    },
    {
      key: 'consts',
      title: t('visual.section.const'),
      chips: mod.consts.map((item) => chip({ kind: 'const', moduleName: mod.name, name: item.name }, item.name))
    },
    {
      key: 'vars',
      title: t('visual.section.var'),
      chips: mod.vars.map((item) => chip({ kind: 'var', moduleName: mod.name, name: item.name }, item.name))
    },
    {
      key: 'inv',
      title: t('visual.section.inv'),
      chips: mod.invariants.map((item, index) =>
        chip({ kind: 'inv', moduleName: mod.name, index }, item.text.replace(/\s+/g, ' ').trim() || `#${index + 1}`)
      )
    },
    {
      key: 'processes',
      title: t('visual.section.processes'),
      chips: mod.processes.map((item) =>
        chip({ kind: 'process', moduleName: mod.name, processName: item.name }, item.name)
      )
    },
    {
      key: 'functions',
      title: t('visual.section.functions'),
      chips: mod.functions.map((item) =>
        chip({ kind: 'function', moduleName: mod.name, functionName: item.name }, item.name)
      )
    },
    {
      key: 'cdfd',
      title: t('visual.section.cdfd'),
      chips: [chip({ kind: 'cdfd', moduleName: mod.name }, t('visual.section.cdfd'))]
    }
  ]
})

function displayName(mod: VisualModuleSummary): string {
  return mod.isSystem ? `SYSTEM_${mod.name}` : mod.name
}

function isChipSelected(selection: EntitySelection): boolean {
  return sameSelection(workspace.selection, selection)
}

function focus(selection: EntitySelection): void {
  menu.value = null
  workspace.revealHybridInCode(selection.moduleName, selection)
}

function onBoardMenu(event: MouseEvent): void {
  const mod = moduleSummary.value
  if (!mod) return
  event.preventDefault()
  const point = contextMenuPoint(event)
  menu.value = {
    x: point.x,
    y: point.y,
    kind: 'board',
    selection: { kind: 'module', moduleName: mod.name }
  }
}

function onChipMenu(event: MouseEvent, selection: EntitySelection): void {
  event.preventDefault()
  event.stopPropagation()
  workspace.selectModule(selection.moduleName, selection)
  const point = contextMenuPoint(event)
  menu.value = { x: point.x, y: point.y, kind: 'entity', selection }
}

function sourceText(): string {
  return workspace.hybridTab?.content ?? ''
}

function replaceIdent(text: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`\\b${escaped}\\b`), to)
}

async function addType(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const name = nextTypeName(mod.types.map((item) => item.name))
  await visual.patchDeclaration({
    moduleName: mod.name,
    kind: 'type',
    action: 'add',
    text: composedTypeText(name, [{ name: nextFieldName([]), type: 'nat' }])
  })
  focus({ kind: 'type', moduleName: mod.name, name })
}

async function addVar(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const name = nextVarName(mod.vars.map((item) => item.name))
  await visual.patchDeclaration({
    moduleName: mod.name,
    kind: 'var',
    action: 'add',
    text: varDeclText(name, 'nat')
  })
  focus({ kind: 'var', moduleName: mod.name, name })
}

async function addConst(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const name = nextConstName(mod.consts.map((item) => item.name))
  await visual.patchDeclaration({
    moduleName: mod.name,
    kind: 'const',
    action: 'add',
    text: constDeclText(name)
  })
  focus({ kind: 'const', moduleName: mod.name, name })
}

async function addInvariant(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const text = nextInvariantPlaceholder(mod.invariants.map((item) => item.text))
  const index = mod.invariants.length
  await visual.patchInvariant({ action: 'add', moduleName: mod.name, text })
  focus({ kind: 'inv', moduleName: mod.name, index })
}

async function addProcess(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const name = nextProcessName(mod.processes.map((item) => item.name))
  await visual.patchProcess({ moduleName: mod.name, kind: 'process', action: 'add', name })
  focus({ kind: 'process', moduleName: mod.name, processName: name })
}

async function addFunction(): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value) return
  const name = nextNumberedName('fn', mod.functions.map((item) => item.name))
  await visual.patchProcess({ moduleName: mod.name, kind: 'function', action: 'add', name })
  focus({ kind: 'function', moduleName: mod.name, functionName: name })
}

async function copySelection(selection: EntitySelection): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || blocked.value || selection.moduleName !== mod.name) return
  if (selection.kind === 'type' || selection.kind === 'var' || selection.kind === 'const') {
    const list = selection.kind === 'type' ? mod.types : selection.kind === 'var' ? mod.vars : mod.consts
    const item = list.find((entry) => entry.name === selection.name)
    if (!item) return
    const name = nextNumberedName(item.name, list.map((entry) => entry.name))
    await visual.patchDeclaration({
      moduleName: mod.name,
      kind: selection.kind,
      action: 'add',
      text: replaceIdent(item.text, item.name, name)
    })
    focus({ kind: selection.kind, moduleName: mod.name, name })
    return
  }
  if (selection.kind === 'inv') {
    const item = mod.invariants[selection.index]
    if (!item) return
    const index = mod.invariants.length
    await visual.patchInvariant({ action: 'add', moduleName: mod.name, text: item.text })
    focus({ kind: 'inv', moduleName: mod.name, index })
    return
  }
  if (selection.kind === 'process') {
    const item = mod.processes.find((entry) => entry.name === selection.processName)
    if (!item?.span) return
    const name = nextNumberedName(item.name, mod.processes.map((entry) => entry.name))
    const template = replaceIdent(sourceText().slice(item.span.start, item.span.end), item.name, name)
    await visual.patchProcess({ moduleName: mod.name, kind: 'process', action: 'add', name, template })
    focus({ kind: 'process', moduleName: mod.name, processName: name })
    return
  }
  if (selection.kind === 'function') {
    const item = mod.functions.find((entry) => entry.name === selection.functionName)
    if (!item?.span) return
    const name = nextNumberedName(item.name, mod.functions.map((entry) => entry.name))
    const template = replaceIdent(sourceText().slice(item.span.start, item.span.end), item.name, name)
    await visual.patchProcess({ moduleName: mod.name, kind: 'function', action: 'add', name, template })
    focus({ kind: 'function', moduleName: mod.name, functionName: name })
  }
}

async function deleteSelection(selection: EntitySelection): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || visual.parseFailed.value || selection.moduleName !== mod.name) return
  if (selection.kind === 'type' || selection.kind === 'var' || selection.kind === 'const') {
    await visual.patchDeclaration({ moduleName: mod.name, kind: selection.kind, action: 'remove', name: selection.name })
  } else if (selection.kind === 'inv') {
    await visual.patchInvariant({ action: 'remove', moduleName: mod.name, index: selection.index })
  } else if (selection.kind === 'process') {
    await visual.patchProcess({ moduleName: mod.name, kind: 'process', action: 'remove', name: selection.processName })
  } else if (selection.kind === 'function') {
    await visual.patchProcess({ moduleName: mod.name, kind: 'function', action: 'remove', name: selection.functionName })
  } else {
    return
  }
  focus({ kind: 'module', moduleName: mod.name })
}

async function onMenu(action: string): Promise<void> {
  const current = menu.value
  menu.value = null
  if (!current) return
  if (action === 'add-type') return addType()
  if (action === 'add-var') return addVar()
  if (action === 'add-const') return addConst()
  if (action === 'add-inv') return addInvariant()
  if (action === 'add-process') return addProcess()
  if (action === 'add-function') return addFunction()
  if (action === 'edit') return focus(current.selection)
  if (action === 'copy') return copySelection(current.selection)
  if (action === 'delete') return deleteSelection(current.selection)
}

function scheduleInv(text: string): void {
  const sel = workspace.selection
  const mod = moduleSummary.value
  if (!mod || sel?.kind !== 'inv' || blocked.value) return
  if (invTimer) clearTimeout(invTimer)
  invTimer = setTimeout(() => {
    invTimer = null
    void visual.patchInvariant({ action: 'patch', moduleName: mod.name, index: sel.index, text })
  }, 400)
}

function onInvInput(event: Event): void {
  invDraft.value = (event.target as HTMLTextAreaElement).value
  scheduleInv(invDraft.value)
}

async function onDocumentPatch(payload: Omit<PatchDocumentPayload, 'source'>): Promise<void> {
  if (blocked.value) return
  visual.scheduleVisualPatch(`${payload.kind}:${payload.processName}`, async (source) => {
    if (!window.studio?.patchDocument) return source
    return window.studio.patchDocument({ ...payload, source })
  })
}

function onPatchInit(isInit: boolean): void {
  const proc = selectedProcess.value
  const mod = moduleSummary.value
  if (!proc || !mod || blocked.value) return
  void visual.patchProcessInit?.({ moduleName: mod.name, processName: proc.name, isInit })
}

function onPatchSignature(signature: string): void {
  const proc = selectedProcess.value
  const mod = moduleSummary.value
  if (!proc || !mod || blocked.value) return
  void visual.patchProcessSignature({ moduleName: mod.name, processName: proc.name, signature })
}

function onPatchExt(vars: Array<{ access: 'rd' | 'wr'; name: string; type?: string }>): void {
  const proc = selectedProcess.value
  const mod = moduleSummary.value
  if (!proc || !mod || blocked.value) return
  void visual.patchExt({ moduleName: mod.name, processName: proc.name, vars })
}

function onRenameProcess(name: string): void {
  const proc = selectedProcess.value
  const mod = moduleSummary.value
  if (!proc || !mod || blocked.value || name === proc.name) return
  void visual.patchProcess({ moduleName: mod.name, kind: 'process', action: 'rename', name: proc.name, newName: name }).then(() => {
    focus({ kind: 'process', moduleName: mod.name, processName: name })
  })
}

function onFunctionPatch(payload: { body?: string; fsf?: { scenarios: FsfModelDto['scenarios']; others?: string } }): void {
  const fn = selectedFunction.value
  const mod = moduleSummary.value
  if (!fn || !mod || blocked.value) return
  void visual.patchFunction({ moduleName: mod.name, name: fn.name, ...payload })
}

function onFunctionSignature(signature: string): void {
  const fn = selectedFunction.value
  const mod = moduleSummary.value
  if (!fn || !mod || blocked.value) return
  void visual.patchFunctionSignature({ moduleName: mod.name, functionName: fn.name, signature })
}

function onRenameFunction(name: string): void {
  const fn = selectedFunction.value
  const mod = moduleSummary.value
  if (!fn || !mod || blocked.value || name === fn.name) return
  void visual.patchProcess({ moduleName: mod.name, kind: 'function', action: 'rename', name: fn.name, newName: name }).then(() => {
    focus({ kind: 'function', moduleName: mod.name, functionName: name })
  })
}

async function onPatchDeclaration(payload: {
  kind: 'const' | 'type' | 'var'
  action: 'patch' | 'add' | 'remove'
  name?: string
  text?: string
}): Promise<void> {
  const mod = moduleSummary.value
  if (!mod || (payload.action === 'remove' ? visual.parseFailed.value : blocked.value)) return
  await visual.patchDeclaration({ moduleName: mod.name, ...payload })
}

function onCdfdProcess(processName: string): void {
  const mod = moduleSummary.value
  if (!mod) return
  focus({ kind: 'process', moduleName: mod.name, processName })
}

function closeMenu(): void {
  menu.value = null
}

onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
  if (invTimer) clearTimeout(invTimer)
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-surface-base">
    <CdfdView
      v-if="showCdfd"
      class="min-h-0 flex-1"
      :graph="cdfdGraph"
      :module-name="moduleSummary?.name"
      active
      @select-process="onCdfdProcess"
    />
    <template v-else>
      <div
        class="studio-scroll min-h-0 flex-[3] overflow-auto p-3"
        @contextmenu="onBoardMenu"
      >
        <div
          v-if="moduleSummary"
          class="rounded-lg border border-border-subtle bg-surface-raised/60 p-3"
        >
          <button
            type="button"
            class="mb-3 block max-w-full truncate rounded px-1 text-left text-[13px] font-semibold"
            :class="
              workspace.selection?.kind === 'module' && workspace.selection.moduleName === moduleSummary.name
                ? 'text-accent'
                : 'text-content-primary'
            "
            @click="focus({ kind: 'module', moduleName: moduleSummary.name })"
            @contextmenu="onChipMenu($event, { kind: 'module', moduleName: moduleSummary.name })"
          >
            {{ displayName(moduleSummary) }}
          </button>
          <div v-for="section in sections" :key="section.key" class="mb-3 last:mb-0">
            <div class="mb-1 text-[10px] font-medium uppercase tracking-wide text-content-muted">
              {{ section.title }}
            </div>
            <div v-if="section.chips.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="(chip, index) in section.chips"
                :key="`${section.key}-${index}`"
                type="button"
                class="max-w-full truncate rounded-md border px-2 py-1 text-left text-[12px]"
                :class="
                  isChipSelected(chip.selection)
                    ? 'border-accent bg-accent/15 text-content-primary'
                    : 'border-border-subtle bg-surface-base text-content-secondary hover:border-accent/40 hover:text-content-primary'
                "
                :title="chip.label"
                @click.stop="focus(chip.selection)"
                @contextmenu="onChipMenu($event, chip.selection)"
              >
                {{ chip.label }}
              </button>
            </div>
            <p v-else class="text-[11px] text-content-muted">—</p>
          </div>
        </div>
        <p v-else class="p-4 text-sm text-content-secondary">{{ t('visual.structure.hint') }}</p>
      </div>
      <div class="studio-scroll min-h-0 flex-[1] overflow-auto border-t border-border-subtle bg-surface-raised p-3">
        <ProcessEditor
          v-if="selectedProcess && moduleSummary"
          :process="selectedProcess"
          :process-name="selectedProcess.name"
          :module-name="moduleSummary.name"
          :initial-decom="selectedProcess.decom"
          :initial-comment="selectedProcess.comment"
          :fsf-model="processFsf"
          :symbols="symbolHints"
          :disabled="blocked"
          @patch="onDocumentPatch"
          @patch-ext="onPatchExt"
          @patch-signature="onPatchSignature"
          @patch-init="onPatchInit"
          @rename="onRenameProcess"
        />
        <FunctionEditor
          v-else-if="selectedFunction && moduleSummary"
          :fn="selectedFunction"
          :module-name="moduleSummary.name"
          :fsf-model="functionFsf"
          :symbols="symbolHints"
          :disabled="blocked"
          @patch="onFunctionPatch"
          @patch-signature="onFunctionSignature"
          @rename="onRenameFunction"
        />
        <DeclarationEditor
          v-else-if="selectedDecl && moduleSummary && selectedDecl.items.length"
          :kind="selectedDecl.kind"
          :items="selectedDecl.items"
          :module-name="moduleSummary.name"
          :disabled="blocked"
          @patch="onPatchDeclaration"
        />
        <label v-else-if="selectedInv" class="block text-[12px] text-content-secondary">
          <span class="mb-1 block font-medium text-content-primary">{{ t('visual.section.inv') }}</span>
          <textarea
            class="visual-field w-full resize-y px-3 py-2 font-mono text-sm"
            rows="4"
            :value="invDraft"
            :disabled="blocked"
            @input="onInvInput"
          />
        </label>
        <p v-else class="text-[12px] leading-relaxed text-content-secondary">{{ t('visual.structure.hint') }}</p>
      </div>
    </template>
    <div
      v-if="menu"
      class="fixed z-50 min-w-[148px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <template v-if="menu.kind === 'board'">
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-type')">{{ t('visual.context.addType') }}</button>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-var')">{{ t('visual.context.addVar') }}</button>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-const')">{{ t('visual.context.addConst') }}</button>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-inv')">{{ t('visual.context.addInvariant') }}</button>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-process')">{{ t('visual.context.addProcess') }}</button>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" :disabled="blocked" @click="onMenu('add-function')">{{ t('visual.context.addFunction') }}</button>
      </template>
      <template v-else>
        <button type="button" class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay" @click="onMenu('edit')">{{ t('visual.context.edit') }}</button>
        <button
          v-if="menu.selection.kind !== 'module' && menu.selection.kind !== 'cdfd'"
          type="button"
          class="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-surface-overlay"
          :disabled="blocked"
          @click="onMenu('copy')"
        >{{ t('visual.context.copy') }}</button>
        <button
          v-if="menu.selection.kind !== 'module' && menu.selection.kind !== 'cdfd'"
          type="button"
          class="block w-full px-3 py-1.5 text-left text-[12px] text-semantic-error hover:bg-surface-overlay"
          :disabled="visual.parseFailed.value"
          @click="onMenu('delete')"
        >{{ t('visual.context.delete') }}</button>
      </template>
    </div>
  </section>
</template>
