<script setup lang="ts">
import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  buildModuleGraphLayout,
  type ModuleGraph,
  type ModuleGraphLayoutOptions,
  type ModuleGraphModuleSize,
  type ModuleGraphNodeRole,
  type ProcessNodeMeta
} from '@agile-sofl/editor-api'
import type { ModuleGraphLayoutPayload } from '../../../../preload/index'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { useDocumentStore } from '../../../stores/document'
import { useEditorUiStore } from '../../../stores/editorUi'
import { useGraphViewport, type GraphBBox } from '../../../composables/useGraphViewport'
import GraphActionsMenu from './GraphActionsMenu.vue'
import GraphTooltip from './GraphTooltip.vue'

type CompoundRow = ModuleGraphLayoutPayload['compounds'][0]['sections'][0]['rows'][0]
type CompoundModule = ModuleGraphLayoutPayload['compounds'][0]

const props = defineProps<{
  graph: ModuleGraph | null
  selected: TreeSelection
  searchQuery?: string
  nodeHints?: Record<string, string>
  processMeta?: Record<string, ProcessNodeMeta>
}>()

const emit = defineEmits<{
  select: [selection: TreeSelection]
  revealDecom: [payload: { moduleName: string; processName: string }]
  contextmenu: [payload: { x: number; y: number; selection: TreeSelection }]
}>()

const { t } = useI18n()
const doc = useDocumentStore()
const editorUi = useEditorUiStore()
const containerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const hoveredId = ref<string | null>(null)
const hoveredEdgeIndex = ref<number | null>(null)
const tooltip = ref<{ x: number; y: number; text: string } | null>(null)
const layout = shallowRef<ModuleGraphLayoutPayload | null>(null)
const layoutError = ref<string | null>(null)
const tidyLayout = ref(false)
const moduleSizes = ref<Record<string, ModuleGraphModuleSize>>({})
const resizing = ref<{
  moduleId: string
  startX: number
  startY: number
  startW: number
  startH: number
} | null>(null)
let layoutGen = 0
let resizeRafId: number | null = null

const MODULE_SIZE_KEY = 'studio-graph-module-sizes'
const MIN_MODULE_W = 200
const MIN_MODULE_H = 120
const RESIZE_HANDLE = 10

const activeFilePath = computed(() => doc.activeTab?.filePath ?? '')
const graphEnabled = computed(() => editorUi.sideView === 'graph')

function normalizeModuleSize(size: ModuleGraphModuleSize): ModuleGraphModuleSize | null {
  if (size.width != null) return size
  // Legacy aspect-only entries cannot drive layout; drop them.
  return null
}

function loadModuleSizes(filePath: string): void {
  if (!filePath) {
    moduleSizes.value = {}
    return
  }
  try {
    const all = JSON.parse(localStorage.getItem(MODULE_SIZE_KEY) ?? '{}') as Record<
      string,
      Record<string, ModuleGraphModuleSize>
    >
    const raw = all[filePath] ?? {}
    const normalized: Record<string, ModuleGraphModuleSize> = {}
    for (const [id, size] of Object.entries(raw)) {
      const n = normalizeModuleSize(size)
      if (n) normalized[id] = n
    }
    moduleSizes.value = normalized
  } catch {
    moduleSizes.value = {}
  }
}

function persistModuleSizes(filePath: string, sizes: Record<string, ModuleGraphModuleSize>): void {
  if (!filePath) return
  try {
    const all = JSON.parse(localStorage.getItem(MODULE_SIZE_KEY) ?? '{}') as Record<
      string,
      Record<string, ModuleGraphModuleSize>
    >
    if (Object.keys(sizes).length === 0) delete all[filePath]
    else all[filePath] = sizes
    localStorage.setItem(MODULE_SIZE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

watch(activeFilePath, (path) => loadModuleSizes(path), { immediate: true })

/** Paint order: lower depth first (parent behind children). */
const paintOrderCompounds = computed(() => {
  if (!layout.value) return []
  return [...layout.value.compounds].sort((a, b) => {
    const da = (a as CompoundModule & { depth?: number }).depth ?? 0
    const db = (b as CompoundModule & { depth?: number }).depth ?? 0
    if (da !== db) return da - db
    return a.y - b.y
  })
})

function cloneForIpc<T>(value: T): T {
  return JSON.parse(JSON.stringify(toRaw(value))) as T
}

function layoutOptions(): ModuleGraphLayoutOptions {
  const aspectEntry = Object.entries(moduleSizes.value).find(([, s]) => s.aspect != null)
  return cloneForIpc({
    searchQuery: props.searchQuery ?? '',
    tidy: tidyLayout.value,
    orientation: 'portrait' as const,
    moduleSizes: moduleSizes.value,
    layoutAspect: aspectEntry?.[1]?.aspect,
    processMeta: props.processMeta
  })
}

function rebuildLayout(): void {
  if (!graphEnabled.value || !props.graph?.nodes?.length) {
    layout.value = null
    layoutError.value = null
    return
  }
  const gen = ++layoutGen
  try {
    const result = buildModuleGraphLayout(cloneForIpc(props.graph), layoutOptions())
    if (gen !== layoutGen) return
    layout.value = result as ModuleGraphLayoutPayload
    layoutError.value = null
  } catch (e) {
    if (gen !== layoutGen) return
    layoutError.value = e instanceof Error ? e.message : String(e)
    layout.value = null
  }
}

watch(
  () =>
    [
      props.graph,
      props.searchQuery,
      props.processMeta,
      graphEnabled.value,
      tidyLayout.value,
      activeFilePath.value,
      moduleSizes.value
    ] as const,
  () => rebuildLayout(),
  { immediate: true, deep: true }
)

const bboxRef = computed<GraphBBox | null>(() => layout.value?.bbox ?? null)
const viewport = useGraphViewport(containerRef, bboxRef, graphEnabled)

watch(
  () => [layout.value?.compounds.length, props.searchQuery],
  () => {
    if (graphEnabled.value && !resizing.value) viewport.fitToView()
  }
)

function roleLabel(role?: ModuleGraphNodeRole): string {
  if (!role) return ''
  return t(`visual.nodeRole.${role}`)
}

function rowSelection(row: CompoundRow): TreeSelection {
  if (row.kind === 'submodule') return { kind: 'module', moduleName: row.moduleName }
  if (row.kind === 'process' && row.processName) {
    return { kind: 'process', moduleName: row.moduleName, processName: row.processName }
  }
  if (row.kind === 'function' && row.functionName) {
    return { kind: 'function', moduleName: row.moduleName, functionName: row.functionName }
  }
  return { kind: 'module', moduleName: row.moduleName }
}

function onRowClick(row: CompoundRow, e: MouseEvent): void {
  e.stopPropagation()
  emit('select', rowSelection(row))
}

function onRowContext(row: CompoundRow, e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  emit('select', rowSelection(row))
  emit('contextmenu', { x: e.clientX, y: e.clientY, selection: rowSelection(row) })
}

function isModuleSelected(moduleId: string): boolean {
  const sel = props.selected
  return sel?.kind === 'module' && sel.moduleName === moduleId
}

function isRowSelected(row: CompoundRow): boolean {
  const sel = props.selected
  if (!sel) return false
  if (row.kind === 'submodule') {
    return sel.kind === 'module' && sel.moduleName === row.moduleName
  }
  if (row.kind === 'process' && sel.kind === 'process') {
    return sel.moduleName === row.moduleName && sel.processName === row.processName
  }
  if (row.kind === 'function' && sel.kind === 'function') {
    return sel.moduleName === row.moduleName && sel.functionName === row.functionName
  }
  return false
}

function isModuleCascade(compound: CompoundModule): boolean {
  const sel = props.selected
  if (!sel) return false
  return sel.moduleName === compound.moduleId
}

function isModuleHeaderSelected(compound: CompoundModule): boolean {
  return isModuleSelected(compound.moduleId)
}

function processMetaFor(nodeId: string): ProcessNodeMeta | undefined {
  return props.processMeta?.[nodeId]
}

type ProcessChipStyle = {
  fill: string
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  accentBar?: boolean
  badge?: 'init' | 'ext'
}

function processChipStyle(row: CompoundRow): ProcessChipStyle {
  const meta = processMetaFor(row.nodeId)
  const base: ProcessChipStyle = {
    fill: 'color-mix(in srgb, var(--role-process) 8%, var(--surface-raised))',
    stroke: 'var(--border-subtle)',
    strokeWidth: 1
  }
  if (meta?.isInit) {
    return {
      ...base,
      fill: 'color-mix(in srgb, var(--accent) 12%, var(--surface-raised))',
      stroke: 'var(--accent)',
      accentBar: true,
      badge: 'init'
    }
  }
  if (meta?.isAlias) {
    return {
      ...base,
      stroke: 'var(--role-process)',
      strokeDasharray: '4 2'
    }
  }
  if (meta?.hasExt) {
    return {
      ...base,
      stroke: 'var(--role-process)',
      badge: 'ext'
    }
  }
  return base
}

function rowFill(row: CompoundRow, compound: CompoundModule): string {
  if (isRowSelected(row)) return 'color-mix(in srgb, var(--accent) 18%, transparent)'
  if (hoveredId.value === row.nodeId) return 'color-mix(in srgb, var(--accent) 8%, var(--surface-raised))'
  if (moduleLinkContext.value?.relatedNodeIds.has(row.nodeId)) {
    return 'color-mix(in srgb, var(--accent) 6%, var(--surface-raised))'
  }
  if (isModuleCascade(compound) && !isRowSelected(row)) {
    return 'color-mix(in srgb, var(--accent) 5%, transparent)'
  }
  if (row.kind === 'process') return processChipStyle(row).fill
  if (row.kind === 'function') return 'color-mix(in srgb, var(--role-function) 8%, var(--surface-raised))'
  return 'transparent'
}

function rowStroke(row: CompoundRow): string {
  if (isRowSelected(row)) return 'var(--accent)'
  if (row.kind === 'process') return processChipStyle(row).stroke
  return 'var(--border-subtle)'
}

function rowStrokeWidth(row: CompoundRow): number {
  if (isRowSelected(row)) return 2
  if (row.kind === 'process') return processChipStyle(row).strokeWidth
  return 1
}

function rowStrokeDash(row: CompoundRow): string | undefined {
  if (row.kind !== 'process') return undefined
  return processChipStyle(row).strokeDasharray
}

function visibleRows(sec: CompoundModule['sections'][0]): CompoundRow[] {
  return sec.rows.filter((r) => !r.hidden)
}

function hintFor(nodeId: string): string {
  return props.nodeHints?.[nodeId] ?? ''
}

function onRowHover(row: CompoundRow, e: MouseEvent): void {
  hoveredId.value = row.nodeId
  const text = hintFor(row.nodeId)
  if (text) tooltip.value = { x: e.clientX, y: e.clientY, text }
}

function onRowLeave(): void {
  hoveredId.value = null
  tooltip.value = null
}

function graphNodeIdFromSelection(sel: TreeSelection | null): string | null {
  if (!sel) return null
  if (sel.kind === 'process') return `${sel.moduleName}::process::${sel.processName}`
  if (sel.kind === 'function') return `${sel.moduleName}::function::${sel.functionName}`
  return null
}

function selectionFromGraphNodeId(nodeId: string): TreeSelection | null {
  const parts = nodeId.split('::')
  if (parts.length !== 3) return null
  const [moduleName, kind, name] = parts
  if (kind === 'process') return { kind: 'process', moduleName, processName: name }
  if (kind === 'function') return { kind: 'function', moduleName, functionName: name }
  return null
}

function moduleIdFromGraphNodeId(nodeId: string): string | null {
  const node = props.graph?.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  if (node.kind === 'module') return node.id
  return node.parentId ?? null
}

function processNodeIdsForModule(moduleId: string): string[] {
  if (!props.graph) return []
  return props.graph.nodes
    .filter((n) => (n.kind === 'process' || n.kind === 'function') && n.parentId === moduleId)
    .map((n) => n.id)
}

const moduleLinkContext = computed(() => {
  const sel = props.selected
  if (!sel || sel.kind !== 'module' || !layout.value) return null
  const procIds = new Set(processNodeIdsForModule(sel.moduleName))
  if (procIds.size === 0) return null
  const linkedEdges = layout.value.edges.filter((e) => procIds.has(e.from) || procIds.has(e.to))
  if (linkedEdges.length === 0) return null
  const relatedModules = new Set<string>()
  const relatedNodeIds = new Set<string>()
  for (const e of linkedEdges) {
    relatedNodeIds.add(e.from)
    relatedNodeIds.add(e.to)
    const fromMod = moduleIdFromGraphNodeId(e.from)
    const toMod = moduleIdFromGraphNodeId(e.to)
    if (fromMod && fromMod !== sel.moduleName) relatedModules.add(fromMod)
    if (toMod && toMod !== sel.moduleName) relatedModules.add(toMod)
  }
  return { linkedEdges, relatedModules, relatedNodeIds, procIds }
})

const edgeHighlightNodeIds = computed(() => {
  const ids = new Set<string>()
  if (hoveredId.value) ids.add(hoveredId.value)
  const selectedId = graphNodeIdFromSelection(props.selected)
  if (selectedId) ids.add(selectedId)
  if (moduleLinkContext.value) {
    for (const id of moduleLinkContext.value.relatedNodeIds) ids.add(id)
  }
  if (hoveredEdgeIndex.value !== null && layout.value?.edges[hoveredEdgeIndex.value]) {
    const edge = layout.value.edges[hoveredEdgeIndex.value]
    ids.add(edge.from)
    ids.add(edge.to)
  }
  return ids
})

const hasEdgeHighlight = computed(
  () =>
    edgeHighlightNodeIds.value.size > 0 ||
    hoveredEdgeIndex.value !== null ||
    moduleLinkContext.value !== null
)

type LayoutEdge = NonNullable<ModuleGraphLayoutPayload>['edges'][0]

function edgeVisualState(edge: LayoutEdge, index: number): {
  opacity: number
  strokeWidth: number
  showLabel: boolean
} {
  const directHighlight =
    hoveredEdgeIndex.value === index ||
    (graphNodeIdFromSelection(props.selected) &&
      (edge.from === graphNodeIdFromSelection(props.selected) ||
        edge.to === graphNodeIdFromSelection(props.selected)))
  const moduleLinked =
    moduleLinkContext.value &&
    (moduleLinkContext.value.procIds.has(edge.from) ||
      moduleLinkContext.value.procIds.has(edge.to))
  const hoverHighlight =
    edgeHighlightNodeIds.value.has(edge.from) || edgeHighlightNodeIds.value.has(edge.to)

  if (directHighlight || hoveredEdgeIndex.value === index) {
    return { opacity: 1, strokeWidth: 2.5, showLabel: true }
  }
  if (moduleLinked) {
    return { opacity: 0.72, strokeWidth: 2, showLabel: true }
  }
  if (hoverHighlight) {
    return { opacity: 0.9, strokeWidth: 2, showLabel: true }
  }
  if (hasEdgeHighlight.value) {
    return { opacity: 0.08, strokeWidth: 1.5, showLabel: false }
  }
  return { opacity: 0.28, strokeWidth: 1.5, showLabel: false }
}

function onEdgeClick(edge: LayoutEdge, e: MouseEvent): void {
  e.stopPropagation()
  const sel = selectionFromGraphNodeId(edge.from)
  if (sel?.kind === 'process') {
    emit('select', sel)
    emit('revealDecom', { moduleName: sel.moduleName, processName: sel.processName })
  }
}

function onEdgeHover(index: number): void {
  hoveredEdgeIndex.value = index
  hoveredId.value = null
  tooltip.value = null
}

function onEdgeLeave(): void {
  hoveredEdgeIndex.value = null
}

function isModuleSoftHighlighted(compound: CompoundModule): boolean {
  return moduleLinkContext.value?.relatedModules.has(compound.moduleId) ?? false
}

function moduleSoftHighlightFill(compound: CompoundModule): string | undefined {
  if (!isModuleSoftHighlighted(compound)) return undefined
  return 'color-mix(in srgb, var(--accent) 7%, var(--surface-raised))'
}

const CHAR_W = 7

function truncateLabel(label: string, maxChars: number): string {
  return label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label
}

function clipId(compound: CompoundModule): string {
  return `clip-${compound.moduleId}-${compound.depth}`
}

function onTidy(): void {
  tidyLayout.value = !tidyLayout.value
}

function onModuleClick(moduleId: string, e: MouseEvent): void {
  e.stopPropagation()
  emit('select', { kind: 'module', moduleName: moduleId })
}

function onModuleContext(moduleId: string, e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  emit('select', { kind: 'module', moduleName: moduleId })
  emit('contextmenu', { x: e.clientX, y: e.clientY, selection: { kind: 'module', moduleName: moduleId } })
}

function cellLabel(row: CompoundRow, rect: { w: number }): string {
  const maxChars = Math.max(4, Math.floor(rect.w / CHAR_W))
  return truncateLabel(row.label, maxChars)
}

function isRootCompound(compound: CompoundModule): boolean {
  return (compound as CompoundModule & { depth?: number }).depth === 0
}

function onResizePointerDown(compound: CompoundModule, e: PointerEvent): void {
  e.stopPropagation()
  e.preventDefault()
  resizing.value = {
    moduleId: compound.moduleId,
    startX: e.clientX,
    startY: e.clientY,
    startW: compound.width,
    startH: compound.height
  }
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
}

function scheduleResizeRebuild(): void {
  if (resizeRafId !== null) return
  resizeRafId = requestAnimationFrame(() => {
    resizeRafId = null
    rebuildLayout()
  })
}

function onResizePointerMove(e: PointerEvent): void {
  if (!resizing.value) return
  const dx = (e.clientX - resizing.value.startX) / viewport.scale.value
  const dy = (e.clientY - resizing.value.startY) / viewport.scale.value
  const dragW = Math.max(MIN_MODULE_W, Math.round(resizing.value.startW + dx))
  const dragH = Math.max(MIN_MODULE_H, Math.round(resizing.value.startH + dy))
  moduleSizes.value = {
    ...moduleSizes.value,
    [resizing.value.moduleId]: {
      width: dragW,
      height: dragH,
      aspect: Math.max(0.35, Math.min(2.5, dragW / dragH))
    }
  }
  scheduleResizeRebuild()
}

function onResizePointerUp(e: PointerEvent): void {
  if (!resizing.value) return
  resizing.value = null
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
  rebuildLayout()
  persistModuleSizes(activeFilePath.value, moduleSizes.value)
  try {
    ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="visual-panel relative h-full overflow-hidden bg-surface-base"
    :class="resizing ? 'cursor-nwse-resize' : viewport.cursorClass.value"
    @wheel="viewport.onWheel"
    @pointerdown="viewport.onPointerDown"
    @pointermove="(e) => { onResizePointerMove(e); viewport.onPointerMove(e) }"
    @pointerup="(e) => { onResizePointerUp(e); viewport.onPointerUp(e) }"
    @pointercancel="(e) => { onResizePointerUp(e); viewport.onPointerUp(e) }"
  >
    <GraphActionsMenu :layout="layout" :svg-ref="svgRef" @tidy="onTidy" />
    <GraphTooltip v-if="tooltip" :x="tooltip.x" :y="tooltip.y" :text="tooltip.text" />
    <p v-if="layoutError" class="p-3 text-sm text-semantic-error">{{ layoutError }}</p>
    <p v-else-if="!layout?.compounds.length" class="p-3 text-sm text-content-secondary">
      {{ t('visual.noModules') }}
    </p>
    <svg v-else ref="svgRef" class="h-full w-full">
      <defs>
        <clipPath
          v-for="compound in paintOrderCompounds.filter((c) => (c.depth ?? 0) > 0)"
          :id="clipId(compound as CompoundModule)"
          :key="`clip-${compound.moduleId}`"
        >
          <rect :x="compound.x" :y="compound.y" :width="compound.width" :height="compound.height" rx="6" />
        </clipPath>
      </defs>
      <g :transform="viewport.viewportTransform.value">
        <g
          v-for="compound in paintOrderCompounds"
          :key="compound.moduleId"
          data-graph-compound
          :clip-path="(compound as CompoundModule & { depth?: number }).depth ? `url(#${clipId(compound as CompoundModule)})` : undefined"
        >
          <rect
            :x="compound.x"
            :y="compound.y"
            :width="compound.width"
            :height="compound.height"
            :rx="(compound as CompoundModule & { depth?: number }).depth ? 6 : 10"
            :fill="moduleSoftHighlightFill(compound as CompoundModule) ?? 'var(--surface-raised)'"
            :stroke="isModuleSoftHighlighted(compound as CompoundModule) ? 'var(--accent)' : 'var(--border-subtle)'"
            :stroke-width="isModuleSoftHighlighted(compound as CompoundModule) ? 1.5 : 1"
            :stroke-opacity="isModuleSoftHighlighted(compound as CompoundModule) ? 0.45 : 1"
            class="pointer-events-none"
          />
          <template v-if="!(compound as CompoundModule & { compact?: boolean }).compact">
            <rect
              v-if="!(compound as CompoundModule & { depth?: number }).depth"
              :x="compound.x"
              :y="compound.y"
              :width="compound.width"
              height="36"
              rx="10"
              fill="color-mix(in srgb, var(--accent) 6%, var(--surface-raised))"
              class="cursor-pointer"
              data-graph-node
              @click="onModuleClick(compound.moduleId, $event)"
              @contextmenu="onModuleContext(compound.moduleId, $event)"
            />
            <rect
              v-else
              :x="compound.x"
              :y="compound.y"
              :width="compound.width"
              :height="Math.min(36, compound.height)"
              :rx="6"
              fill="color-mix(in srgb, var(--accent) 6%, var(--surface-raised))"
              class="cursor-pointer"
              data-graph-node
              @click="onModuleClick(compound.moduleId, $event)"
              @contextmenu="onModuleContext(compound.moduleId, $event)"
            />
          </template>
          <template v-else>
            <rect
              :x="compound.x"
              :y="compound.y"
              :width="compound.width"
              :height="compound.height"
              rx="6"
              fill="color-mix(in srgb, var(--accent) 6%, var(--surface-raised))"
              class="cursor-pointer"
              data-graph-node
              @click="onModuleClick(compound.moduleId, $event)"
              @contextmenu="onModuleContext(compound.moduleId, $event)"
            />
          </template>
          <text
            :x="compound.x + compound.width / 2"
            :y="compound.y + ((compound as CompoundModule & { compact?: boolean }).compact ? compound.height / 2 + 4 : 22)"
            text-anchor="middle"
            class="pointer-events-none"
            fill="var(--text-primary)"
            :font-size="(compound as CompoundModule & { depth?: number }).depth ? 10 : 12"
            font-weight="600"
          >
            {{ truncateLabel(compound.name, Math.max(6, Math.floor(compound.width / CHAR_W))) }}
          </text>
          <text
            v-if="!(compound as CompoundModule & { compact?: boolean }).compact"
            :x="compound.x + compound.width / 2"
            :y="compound.y + 34"
            text-anchor="middle"
            class="pointer-events-none uppercase tracking-wide"
            fill="var(--text-muted)"
            font-size="8"
          >
            {{ roleLabel(compound.moduleRole as ModuleGraphNodeRole | undefined) }}
          </text>

          <g v-for="(sec, si) in compound.sections" :key="`${compound.moduleId}-sec-${si}`">
            <line
              :x1="compound.x + 8"
              :y1="compound.y + sec.y"
              :x2="compound.x + compound.width - 8"
              :y2="compound.y + sec.y"
              stroke="var(--border-subtle)"
              stroke-width="1"
            />
            <text
              :x="compound.x + 12"
              :y="compound.y + sec.y + 14"
              class="pointer-events-none"
              fill="var(--text-muted)"
              font-size="9"
              font-weight="600"
            >
              {{ t(sec.titleKey) }}
            </text>

            <g v-for="row in visibleRows(sec)" :key="row.nodeId">
              <template v-if="row.kind !== 'submodule'">
                <template v-if="compound.rowByNodeId[row.nodeId]">
                  <rect
                    v-if="row.kind === 'process' && processChipStyle(row).accentBar"
                    :x="compound.rowByNodeId[row.nodeId].x"
                    :y="compound.rowByNodeId[row.nodeId].y + 2"
                    width="3"
                    :height="compound.rowByNodeId[row.nodeId].h - 4"
                    rx="1"
                    fill="var(--accent)"
                    class="pointer-events-none"
                  />
                  <rect
                    :x="compound.rowByNodeId[row.nodeId].x"
                    :y="compound.rowByNodeId[row.nodeId].y"
                    :width="compound.rowByNodeId[row.nodeId].w"
                    :height="compound.rowByNodeId[row.nodeId].h"
                    rx="4"
                    :fill="rowFill(row, compound)"
                    :stroke="rowStroke(row)"
                    :stroke-width="rowStrokeWidth(row)"
                    :stroke-dasharray="rowStrokeDash(row)"
                    class="cursor-pointer"
                    data-graph-node
                    @click="onRowClick(row, $event)"
                    @contextmenu="onRowContext(row, $event)"
                    @mouseenter="onRowHover(row, $event)"
                    @mouseleave="onRowLeave"
                  />
                  <g
                    v-if="row.kind === 'process' && processChipStyle(row).badge === 'ext'"
                    class="pointer-events-none"
                  >
                    <rect
                      :x="compound.rowByNodeId[row.nodeId].x + compound.rowByNodeId[row.nodeId].w - 26"
                      :y="compound.rowByNodeId[row.nodeId].y + 2"
                      width="24"
                      height="12"
                      rx="2"
                      fill="color-mix(in srgb, var(--role-process) 20%, var(--surface-raised))"
                    />
                    <text
                      :x="compound.rowByNodeId[row.nodeId].x + compound.rowByNodeId[row.nodeId].w - 14"
                      :y="compound.rowByNodeId[row.nodeId].y + 11"
                      text-anchor="middle"
                      fill="var(--role-process)"
                      font-size="7"
                      font-weight="600"
                    >
                      ext
                    </text>
                  </g>
                  <g
                    v-if="row.kind === 'process' && processChipStyle(row).badge === 'init'"
                    class="pointer-events-none"
                  >
                    <rect
                      :x="compound.rowByNodeId[row.nodeId].x + compound.rowByNodeId[row.nodeId].w - 30"
                      :y="compound.rowByNodeId[row.nodeId].y + 2"
                      width="28"
                      height="12"
                      rx="2"
                      fill="color-mix(in srgb, var(--accent) 20%, var(--surface-raised))"
                    />
                    <text
                      :x="compound.rowByNodeId[row.nodeId].x + compound.rowByNodeId[row.nodeId].w - 16"
                      :y="compound.rowByNodeId[row.nodeId].y + 11"
                      text-anchor="middle"
                      fill="var(--accent)"
                      font-size="7"
                      font-weight="600"
                    >
                      INIT
                    </text>
                  </g>
                  <text
                    :x="compound.rowByNodeId[row.nodeId].x + (row.kind === 'process' && processChipStyle(row).accentBar ? 10 : 8)"
                    :y="compound.rowByNodeId[row.nodeId].y + 16"
                    class="pointer-events-none"
                    fill="var(--text-primary)"
                    font-size="11"
                  >
                    {{ cellLabel(row, compound.rowByNodeId[row.nodeId]) }}
                  </text>
                </template>
              </template>
            </g>
          </g>

          <rect
            v-if="isModuleHeaderSelected(compound)"
            :x="compound.x"
            :y="compound.y"
            :width="compound.width"
            :height="compound.height"
            :rx="(compound as CompoundModule & { depth?: number }).depth ? 6 : 10"
            fill="none"
            stroke="var(--accent)"
            stroke-width="2"
            class="pointer-events-none"
          />
          <rect
            v-else-if="isModuleSoftHighlighted(compound as CompoundModule)"
            :x="compound.x"
            :y="compound.y"
            :width="compound.width"
            :height="compound.height"
            :rx="(compound as CompoundModule & { depth?: number }).depth ? 6 : 10"
            fill="none"
            stroke="var(--accent)"
            stroke-width="1.5"
            stroke-opacity="0.4"
            class="pointer-events-none"
          />

          <g v-if="isRootCompound(compound as CompoundModule)">
            <rect
              :x="compound.x + compound.width - RESIZE_HANDLE"
              :y="compound.y + compound.height - RESIZE_HANDLE"
              :width="RESIZE_HANDLE"
              :height="RESIZE_HANDLE"
              rx="2"
              fill="var(--accent)"
              fill-opacity="0.35"
              stroke="var(--accent)"
              stroke-width="1"
              class="cursor-nwse-resize"
              data-graph-resize
              :aria-label="t('visual.graph.resizeHandle')"
              @pointerdown="onResizePointerDown(compound as CompoundModule, $event)"
            />
            <path
              :d="`M ${compound.x + compound.width - 7} ${compound.y + compound.height - 2} L ${compound.x + compound.width - 2} ${compound.y + compound.height - 7} M ${compound.x + compound.width - 7} ${compound.y + compound.height - 5} L ${compound.x + compound.width - 5} ${compound.y + compound.height - 7}`"
              stroke="var(--accent)"
              stroke-width="1.2"
              fill="none"
              class="pointer-events-none"
            />
          </g>
        </g>

        <g
          v-for="(edge, i) in layout.edges"
          :key="`e-${i}`"
          data-graph-edge
          @mouseenter="onEdgeHover(i)"
          @mouseleave="onEdgeLeave"
          @click="onEdgeClick(edge, $event)"
        >
          <line
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            stroke="transparent"
            stroke-width="14"
            stroke-linecap="round"
            class="cursor-pointer"
            @click="onEdgeClick(edge, $event)"
          />
          <line
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            stroke="var(--accent)"
            :stroke-width="edgeVisualState(edge, i).strokeWidth"
            stroke-dasharray="6 4"
            stroke-linecap="round"
            :opacity="edgeVisualState(edge, i).opacity"
            class="pointer-events-none"
          />
          <circle
            :cx="edge.x1"
            :cy="edge.y1"
            :r="edgeVisualState(edge, i).opacity >= 0.9 ? 3.5 : 2.5"
            fill="var(--accent)"
            :opacity="edgeVisualState(edge, i).opacity"
            class="pointer-events-none"
          />
          <circle
            :cx="edge.x2"
            :cy="edge.y2"
            :r="edgeVisualState(edge, i).opacity >= 0.9 ? 3.5 : 2.5"
            fill="var(--accent)"
            :opacity="edgeVisualState(edge, i).opacity"
            class="pointer-events-none"
          />
          <text
            v-if="edge.kind === 'decom' && edgeVisualState(edge, i).showLabel"
            :x="(edge.x1 + edge.x2) / 2"
            :y="(edge.y1 + edge.y2) / 2 - 8"
            text-anchor="middle"
            fill="var(--accent)"
            font-size="10"
            font-weight="600"
            class="pointer-events-none"
          >
            decom
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
