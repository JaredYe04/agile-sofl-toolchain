<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALLOWED_CLASSES, extractScreenHtml, findTreeItem, listHtmlTree, wrapPrototypeHtml, type HtmlTreeItem } from '@agile-sofl/gui'
import { GUI_MODEL_KEY } from '../../../composables/guiModelContext'
import { useWorkspaceStore } from '../../../stores/workspace'
import GuiPrototype from './GuiPrototype.vue'
import GuiDomTree from './GuiDomTree.vue'
import ResizeSplit from '../../ui/ResizeSplit.vue'
import {
  fullPathToScreenTree,
  prototypePathToFull,
  screenTreePathToFull,
  type GuiProcessEvent
} from '../../../lib/guiPrototype'
import { resolveGuiScreenId } from '../../../lib/guiNavigate'

const PALETTE: Array<{ id: string; label: string; html: string }> = [
  { id: 'stack', label: 'Stack', html: '<div class="as-stack as-gap-md"></div>' },
  { id: 'row', label: 'Row', html: '<div class="as-row as-gap-md"></div>' },
  { id: 'col', label: 'Col', html: '<div class="as-col as-gap-md"></div>' },
  { id: 'grid', label: 'Grid', html: '<div class="as-grid as-gap-md"></div>' },
  { id: 'card', label: 'Card', html: '<div class="as-card"></div>' },
  { id: 'title', label: 'Title', html: '<h1 class="as-title">Title</h1>' },
  {
    id: 'field',
    label: 'Field',
    html: '<label class="as-field">Label<input class="as-input" data-bind="param:x" /></label>'
  },
  {
    id: 'button',
    label: 'Button',
    html: '<button class="as-btn as-btn-primary" data-process="">OK</button>'
  },
  {
    id: 'select',
    label: 'Select',
    html: '<label class="as-field">Label<select class="as-select" data-bind="param:x"></select></label>'
  },
  { id: 'nav', label: 'Nav', html: '<button class="as-btn" data-nav="">Go</button>' },
  {
    id: 'table',
    label: 'Table',
    html: '<table class="as-table"><thead><tr><th>Col</th></tr></thead><tbody></tbody></table>'
  }
]

const CLASS_OPTIONS = [...ALLOWED_CLASSES].filter((c) => c !== 'as-app')

const props = defineProps<{ selectedViewId: string | null }>()
const emit = defineEmits<{ 'update:selectedViewId': [id: string | null] }>()

const { t } = useI18n()
const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiDesignerCanvas requires GUI_MODEL_KEY')
const workspace = useWorkspaceStore()

const selectedPath = ref<string | null>(null)
const prototypeRef = ref<{ applyOutputs: (env: Record<string, string | number | boolean | null>) => void } | null>(
  null
)
const animation = ref<{
  process: string
  unevaluable: boolean
  matched: Array<{ id: string; name: string; kind: string; guard: string; definingCondition: string }>
  scenarios: Array<{ id: string; name: string; kind: string; guard: string; definingCondition: string }>
  outputs: Record<string, string | number | boolean | null>
  pendingNav?: string
} | null>(null)
const mockDraft = ref('')
const leftRatio = ref(0.22)
const centerRatio = ref(0.72)

const screens = computed(() => gui.model.value?.screens ?? [])
const fullHtml = computed(() => gui.model.value?.html ?? '')
const appName = computed(() => gui.model.value?.app.name || 'App')
const selectedScreen = computed(() => {
  const id = resolveGuiScreenId(screens.value, props.selectedViewId)
  return screens.value.find((s) => s.id === id) ?? null
})
const screenHtml = computed(() => {
  const screen = selectedScreen.value
  if (!screen) return ''
  return extractScreenHtml(fullHtml.value, screen.id) || extractScreenHtml(fullHtml.value, screen.name)
})
const prototypeHtml = computed(() => wrapPrototypeHtml(appName.value, screenHtml.value))
const tree = computed(() => listHtmlTree(screenHtml.value))
const selectedNode = computed(() => {
  const local = fullPathToScreenTree(selectedPath.value, screenFullPath())
  return local ? findTreeItem(tree.value, local) : undefined
})
const diags = computed(() => gui.model.value?.diagnostics ?? [])

function fullTree(): HtmlTreeItem[] {
  return listHtmlTree(fullHtml.value)
}

function screenFullPath(): string | null {
  const screen = selectedScreen.value
  if (!screen) return tree.value[0]?.path ?? null
  const walk = (nodes: HtmlTreeItem[]): string | null => {
    for (const n of nodes) {
      if (n.attrs['data-screen'] === screen.id || n.attrs['data-screen'] === screen.name || n.id === screen.id) {
        return n.path
      }
      const nested = walk(n.children)
      if (nested) return nested
    }
    return null
  }
  return walk(fullTree()) ?? '0.0'
}

function screenPath(): string | null {
  return screenFullPath()
}

function insertParent(): string | null {
  const node = selectedNode.value
  if (node && ['div', 'section', 'form', 'label', 'header', 'nav', 'main', 'article', 'aside'].includes(node.tag)) {
    return screenTreePathToFull(node.path, screenFullPath())
  }
  return screenPath()
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

async function addView(): Promise<void> {
  const id = newId('view')
  await gui.addScreen({
    id,
    name: `View${screens.value.length + 1}`,
    title: t('gui.newScreen'),
    widgets: []
  })
  emit('update:selectedViewId', id)
}

async function insertSnippet(snippet: string): Promise<void> {
  const parent = insertParent()
  if (!parent) return
  await gui.insertHtml(parent, snippet)
}

function selectScreen(id: string): void {
  emit('update:selectedViewId', resolveGuiScreenId(screens.value, id) ?? id)
  selectedPath.value = null
}

function onNavigate(ref: string): void {
  const id = resolveGuiScreenId(screens.value, ref)
  if (id) emit('update:selectedViewId', id)
}

function onPrototypeSelect(payload: { id: string | null; path: string | null }): void {
  selectedPath.value = prototypePathToFull(payload.path, screenFullPath())
}

function onTreeSelect(localPath: string): void {
  selectedPath.value = screenTreePathToFull(localPath, screenFullPath())
}

async function onProcess(event: GuiProcessEvent): Promise<void> {
  const asfl = workspace.hybridTab?.content ?? ''
  if (!window.studio?.animateGuiProcess || !asfl.trim()) return
  const result = await window.studio.animateGuiProcess({
    asfl,
    process: event.process,
    env: event.env
  })
  animation.value = { ...result, pendingNav: event.nav }
  mockDraft.value = JSON.stringify(result.outputs, null, 2)
  if (!result.unevaluable && result.matched[0]) {
    prototypeRef.value?.applyOutputs(result.outputs)
  }
}

async function pickScenario(id: string): Promise<void> {
  const current = animation.value
  if (!current || !window.studio?.animateGuiProcess) return
  const asfl = workspace.hybridTab?.content ?? ''
  const result = await window.studio.animateGuiProcess({
    asfl,
    process: current.process,
    env: current.outputs,
    scenarioId: id
  })
  animation.value = { ...result, pendingNav: current.pendingNav }
  mockDraft.value = JSON.stringify(result.outputs, null, 2)
  prototypeRef.value?.applyOutputs(result.outputs)
}

function applyMockOutputs(): void {
  try {
    const parsed = JSON.parse(mockDraft.value) as Record<string, string | number | boolean | null>
    prototypeRef.value?.applyOutputs(parsed)
    if (animation.value) animation.value = { ...animation.value, outputs: parsed }
  } catch {
    /* keep previous mock */
  }
}

async function patchAttr(key: string, value: string): Promise<void> {
  const path = selectedPath.value
  if (!path) return
  await gui.patchNode(path, { [key]: value })
}

async function toggleClass(name: string): Promise<void> {
  const node = selectedNode.value
  if (!node || !selectedPath.value) return
  const next = node.classes.includes(name) ? node.classes.filter((c) => c !== name) : [...node.classes, name]
  await gui.patchNode(selectedPath.value, { class: next.join(' ') })
}

async function patchText(value: string): Promise<void> {
  const path = selectedPath.value
  if (!path) return
  await gui.patchNode(path, undefined, value)
}

async function removeSelected(): Promise<void> {
  if (!selectedPath.value) return
  await gui.removeNode(selectedPath.value)
  selectedPath.value = null
}

watch(
  () => props.selectedViewId,
  () => {
    selectedPath.value = screenPath()
  }
)
</script>

<template>
  <div class="flex h-full min-h-0 bg-surface-base">
    <ResizeSplit
      direction="horizontal"
      :ratio="leftRatio"
      :min-first="0.12"
      :min-second="0.4"
      class="min-h-0 min-w-0 flex-1"
      @update:ratio="leftRatio = $event"
    >
      <template #first>
    <aside class="flex h-full min-h-0 min-w-0 flex-col">
      <div class="flex items-center justify-between px-2 py-1 text-[11px] text-content-secondary">
        <span>{{ t('gui.screens') }}</span>
        <button type="button" class="rounded px-1 hover:bg-surface-overlay" @click="addView">+</button>
      </div>
      <ul class="shrink-0 px-1 pb-1">
        <li v-for="screen in screens" :key="screen.id">
          <button
            type="button"
            class="mb-0.5 w-full rounded px-2 py-1 text-left text-xs"
            :class="screen.id === selectedScreen?.id ? 'bg-accent/15 text-accent' : 'hover:bg-surface-overlay'"
            @click="selectScreen(screen.id)"
          >
            {{ screen.title || screen.name }}
            <span class="mt-0.5 block font-mono text-[10px] text-content-muted">{{ screen.name }}.html</span>
          </button>
        </li>
      </ul>
      <p class="px-2 pb-1 text-[10px] uppercase tracking-wide text-content-muted">{{ t('gui.domTree') }}</p>
      <div class="studio-scroll min-h-0 flex-1 overflow-auto px-1">
        <GuiDomTree :nodes="tree" :selected-path="fullPathToScreenTree(selectedPath, screenFullPath())" @select="onTreeSelect" />
      </div>
      <div class="border-t border-border-subtle p-1">
        <p class="px-1 pb-1 text-[10px] uppercase tracking-wide text-content-muted">{{ t('gui.palette') }}</p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="item in PALETTE"
            :key="item.id"
            type="button"
            class="rounded border border-border-subtle px-1.5 py-0.5 text-[11px] hover:bg-surface-overlay"
            @click="insertSnippet(item.html)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </aside>
      </template>
      <template #second>
    <ResizeSplit
      direction="horizontal"
      :ratio="centerRatio"
      :min-first="0.35"
      :min-second="0.16"
      class="min-h-0 min-w-0 flex-1"
      @update:ratio="centerRatio = $event"
    >
      <template #first>
    <section class="flex h-full min-h-0 min-w-0 flex-col">
      <header class="flex h-8 items-center border-b border-border-subtle px-2 text-[11px]">
        <span class="text-content-secondary">{{ selectedScreen?.name }}</span>
      </header>
      <GuiPrototype
        ref="prototypeRef"
        class="min-h-0 flex-1"
        :html="prototypeHtml"
        :screen-id="selectedScreen?.id"
        interactive
        @navigate="onNavigate"
        @process="onProcess"
        @select="onPrototypeSelect"
      />
    </section>
      </template>
      <template #second>
    <aside class="flex h-full min-h-0 min-w-0 flex-col p-2 text-xs">
      <p class="mb-1 shrink-0 text-[10px] uppercase tracking-wide text-content-muted">{{ t('gui.inspector') }}</p>
      <div class="studio-scroll min-h-0 flex-1 space-y-2 overflow-auto">
      <div v-if="selectedNode" class="space-y-2">
        <p><span class="text-content-muted">&lt;{{ selectedNode.tag }}&gt;</span> {{ selectedNode.path }}</p>
        <label class="block">
          <span class="text-content-muted">{{ t('gui.dataProcess') }}</span>
          <input
            class="mt-0.5 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
            :value="selectedNode.attrs['data-process'] ?? ''"
            @change="patchAttr('data-process', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="block">
          <span class="text-content-muted">{{ t('gui.dataBind') }}</span>
          <input
            class="mt-0.5 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
            :value="selectedNode.attrs['data-bind'] ?? ''"
            @change="patchAttr('data-bind', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="block">
          <span class="text-content-muted">{{ t('gui.dataNav') }}</span>
          <input
            class="mt-0.5 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
            :value="selectedNode.attrs['data-nav'] ?? ''"
            @change="patchAttr('data-nav', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="block">
          <span class="text-content-muted">{{ t('gui.dataScenario') }}</span>
          <input
            class="mt-0.5 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
            :value="selectedNode.attrs['data-scenario'] ?? ''"
            @change="patchAttr('data-scenario', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label v-if="selectedNode.text != null" class="block">
          <span class="text-content-muted">{{ t('gui.widgetLabel') }}</span>
          <input
            class="mt-0.5 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
            :value="selectedNode.text"
            @change="patchText(($event.target as HTMLInputElement).value)"
          />
        </label>
        <div>
          <p class="mb-1 text-content-muted">{{ t('gui.classes') }}</p>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="name in CLASS_OPTIONS"
              :key="name"
              type="button"
              class="rounded border px-1 py-0.5 text-[10px]"
              :class="
                selectedNode.classes.includes(name)
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-subtle text-content-secondary'
              "
              @click="toggleClass(name)"
            >
              {{ name }}
            </button>
          </div>
        </div>
        <button type="button" class="text-[11px] text-semantic-error hover:underline" @click="removeSelected">
          {{ t('gui.remove') }}
        </button>
      </div>
      <div v-if="animation" class="border-t border-border-subtle pt-2">
        <p class="font-medium">{{ t('gui.animation') }}</p>
        <p class="text-content-muted">{{ animation.process }}</p>
        <p v-if="animation.unevaluable" class="mt-1 text-content-secondary">{{ t('gui.pickScenario') }}</p>
        <button
          v-for="s in animation.unevaluable ? animation.scenarios : animation.matched"
          :key="s.id"
          type="button"
          class="mt-1 w-full rounded border border-border-subtle px-2 py-1 text-left hover:bg-surface-overlay"
          @click="pickScenario(s.id)"
        >
          <span class="font-medium">{{ s.name }}</span>
          <span class="block text-content-muted">{{ s.guard }}</span>
        </button>
        <label class="mt-2 block">
          <span class="text-content-muted">{{ t('gui.mockOutputs') }}</span>
          <textarea
            v-model="mockDraft"
            class="studio-scroll mt-0.5 h-20 w-full rounded border border-border-subtle bg-surface-raised px-1 py-0.5 font-mono text-[10px]"
          />
        </label>
        <button type="button" class="mt-1 text-[11px] text-accent hover:underline" @click="applyMockOutputs">
          {{ t('gui.applyOutputs') }}
        </button>
      </div>
      <ul v-if="diags.length" class="space-y-1 pt-2 text-[11px] text-semantic-warning">
        <li v-for="d in diags" :key="d.code + d.message">{{ d.message }}</li>
      </ul>
      </div>
    </aside>
      </template>
    </ResizeSplit>
      </template>
    </ResizeSplit>
  </div>
</template>
