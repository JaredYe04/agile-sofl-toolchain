<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ALLOWED_CLASSES, findTreeItem, listHtmlTree, type HtmlTreeItem } from '@agile-sofl/gui'
import { GUI_MODEL_KEY } from '../../../composables/guiModelContext'
import { useWorkspaceStore } from '../../../stores/workspace'
import GuiPrototype from './GuiPrototype.vue'
import GuiDomTree from './GuiDomTree.vue'
import ResizeSplit from '../../ui/ResizeSplit.vue'
import type { GuiProcessEvent } from '../../../lib/guiPrototype'

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

const runMode = ref(true)
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
const html = computed(() => gui.model.value?.html ?? '')
const tree = computed(() => listHtmlTree(html.value))
const selectedScreen = computed(() => screens.value.find((s) => s.id === props.selectedViewId) ?? null)
const selectedNode = computed(() =>
  selectedPath.value ? findTreeItem(tree.value, selectedPath.value) : undefined
)
const diags = computed(() => gui.model.value?.diagnostics ?? [])

function screenPath(): string | null {
  const id = props.selectedViewId
  if (!id) return tree.value[0]?.children[0]?.path ?? tree.value[0]?.path ?? null
  const walk = (nodes: HtmlTreeItem[]): string | null => {
    for (const n of nodes) {
      if (n.attrs['data-screen'] === id || n.id === id) return n.path
      const nested = walk(n.children)
      if (nested) return nested
    }
    return null
  }
  return walk(tree.value)
}

function insertParent(): string | null {
  const node = selectedNode.value
  if (node && ['div', 'section', 'form', 'label', 'header', 'nav', 'main', 'article', 'aside'].includes(node.tag)) {
    return node.path
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
  emit('update:selectedViewId', id)
  selectedPath.value = null
}

async function onProcess(event: GuiProcessEvent): Promise<void> {
  const asfl = workspace.hybridTab?.content ?? ''
  if (!window.studio?.animateGuiProcess || !asfl.trim()) {
    if (event.nav) emit('update:selectedViewId', event.nav)
    return
  }
  const result = await window.studio.animateGuiProcess({
    asfl,
    process: event.process,
    env: event.env
  })
  animation.value = { ...result, pendingNav: event.nav }
  mockDraft.value = JSON.stringify(result.outputs, null, 2)
  if (!result.unevaluable && result.matched[0]) {
    prototypeRef.value?.applyOutputs(result.outputs)
    if (event.nav) emit('update:selectedViewId', event.nav)
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
  if (current.pendingNav) emit('update:selectedViewId', current.pendingNav)
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
            :class="screen.id === selectedViewId ? 'bg-accent/15 text-accent' : 'hover:bg-surface-overlay'"
            @click="selectScreen(screen.id)"
          >
            {{ screen.title || screen.name }}
          </button>
        </li>
      </ul>
      <p class="px-2 pb-1 text-[10px] uppercase tracking-wide text-content-muted">{{ t('gui.domTree') }}</p>
      <div class="studio-scroll min-h-0 flex-1 overflow-auto px-1">
        <GuiDomTree :nodes="tree" :selected-path="selectedPath" @select="selectedPath = $event" />
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
      <header class="flex h-8 items-center justify-between border-b border-border-subtle px-2 text-[11px]">
        <span class="text-content-secondary">{{ selectedScreen?.name }}</span>
        <label class="flex items-center gap-1 text-content-secondary">
          <input v-model="runMode" type="checkbox" />
          {{ t('gui.runMode') }}
        </label>
      </header>
      <GuiPrototype
        ref="prototypeRef"
        class="min-h-0 flex-1"
        :html="html"
        :screen-id="selectedViewId"
        :interactive="runMode"
        @navigate="emit('update:selectedViewId', $event)"
        @process="onProcess"
        @select="selectedPath = $event.path"
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
