<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModuleGraphNode, ModuleGraphNodeRole } from '@agile-sofl/editor-api'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { useEditorUiStore } from '../../../stores/editorUi'
import { useGraphViewport, type GraphBBox } from '../../../composables/useGraphViewport'
import GraphToolPalette from './GraphToolPalette.vue'

const NODE_W = 128
const NODE_H = 52

const props = defineProps<{
  graph: { nodes: ModuleGraphNode[]; edges: { from: string; to: string; kind: string }[] } | null
  selected: TreeSelection
  searchQuery?: string
}>()

const emit = defineEmits<{
  select: [selection: TreeSelection]
  contextmenu: [payload: { x: number; y: number; selection: TreeSelection }]
}>()

const { t } = useI18n()
const editorUi = useEditorUiStore()
const containerRef = ref<HTMLElement | null>(null)
const hoveredId = ref<string | null>(null)

const layout = computed(() => {
  const nodes = props.graph?.nodes ?? []
  const edges = props.graph?.edges ?? []
  const q = (props.searchQuery ?? '').trim().toLowerCase()
  const filtered = q
    ? nodes.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
    : nodes
  const moduleNodes = filtered.filter((n) => n.kind === 'module')
  const positions = new Map<string, { x: number; y: number }>()
  let y = 56
  const rowHeight = 110
  for (const mod of moduleNodes) {
    positions.set(mod.id, { x: 120, y })
    const children = filtered.filter((n) => n.parentId === mod.id)
    let cx = 300
    const childRow = y + 52
    for (const child of children) {
      positions.set(child.id, { x: cx, y: childRow })
      cx += 160
    }
    y += rowHeight + Math.max(0, children.length - 1) * 10
  }
  let minX = 0
  let minY = 0
  let maxX = 640
  let maxY = 400
  for (const p of positions.values()) {
    minX = Math.min(minX, p.x - NODE_W / 2)
    minY = Math.min(minY, p.y - NODE_H / 2)
    maxX = Math.max(maxX, p.x + NODE_W / 2)
    maxY = Math.max(maxY, p.y + NODE_H / 2)
  }
  return { nodes: filtered, positions, edges, bbox: { minX, minY, maxX, maxY } as GraphBBox }
})

const bboxRef = computed(() => layout.value.bbox)
const graphEnabled = computed(() => editorUi.sideView === 'graph')

const viewport = useGraphViewport(containerRef, bboxRef, graphEnabled)

watch(
  () => props.graph?.nodes?.length,
  () => {
    if (graphEnabled.value) viewport.fitToView()
  }
)

function roleLabel(role?: ModuleGraphNodeRole): string {
  if (!role) return ''
  return t(`visual.nodeRole.${role}`)
}

function onNodeClick(node: ModuleGraphNode, e: MouseEvent): void {
  e.stopPropagation()
  if (node.kind === 'module') {
    emit('select', { kind: 'module', moduleName: node.name.replace(/^SYSTEM_/, '') })
    return
  }
  const parentId = node.parentId
  if (!parentId) return
  const moduleName = parentId.replace(/^SYSTEM_/, '')
  if (node.kind === 'process') {
    emit('select', { kind: 'process', moduleName, processName: node.name })
  } else if (node.kind === 'function') {
    emit('select', { kind: 'function', moduleName, functionName: node.name })
  }
}

function onNodeContext(node: ModuleGraphNode, e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  onNodeClick(node, e)
  const sel = props.selected
  if (sel) emit('contextmenu', { x: e.clientX, y: e.clientY, selection: sel })
}

function isSelected(node: ModuleGraphNode): boolean {
  const sel = props.selected
  if (!sel) return false
  if (node.kind === 'module' && sel.kind === 'module') {
    return node.name === sel.moduleName || node.name === `SYSTEM_${sel.moduleName}`
  }
  if (node.kind === 'process' && sel.kind === 'process') {
    return node.name === sel.processName && node.parentId?.includes(sel.moduleName)
  }
  if (node.kind === 'function' && sel.kind === 'function') {
    return node.name === sel.functionName && node.parentId === sel.moduleName
  }
  return false
}

function nodeFill(node: ModuleGraphNode): string {
  if (isSelected(node)) return 'color-mix(in srgb, var(--accent) 22%, transparent)'
  if (hoveredId.value === node.id) return 'color-mix(in srgb, var(--accent) 10%, var(--surface-raised))'
  if (node.kind === 'process') return 'color-mix(in srgb, #0ea5e9 12%, var(--surface-raised))'
  if (node.kind === 'function') return 'color-mix(in srgb, #f97316 12%, var(--surface-raised))'
  return 'var(--surface-raised)'
}

function edgeMid(edge: { from: string; to: string }): { x: number; y: number } | null {
  const a = layout.value.positions.get(edge.from)
  const b = layout.value.positions.get(edge.to)
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 8 }
}
</script>

<template>
  <div
    ref="containerRef"
    class="visual-panel relative h-full overflow-hidden bg-surface-base"
    :class="viewport.cursorClass.value"
    @wheel="viewport.onWheel"
    @pointerdown="viewport.onPointerDown"
    @pointermove="viewport.onPointerMove"
    @pointerup="viewport.onPointerUp"
    @pointercancel="viewport.onPointerUp"
  >
    <GraphToolPalette />
    <p v-if="!graph?.nodes?.length" class="p-3 text-sm text-content-secondary">{{ t('visual.noModules') }}</p>
    <svg v-else class="h-full w-full touch-none">
      <g :transform="viewport.viewportTransform.value">
        <g v-for="(edge, i) in layout.edges" :key="`e-${i}`">
          <line
            :x1="layout.positions.get(edge.from)?.x ?? 0"
            :y1="layout.positions.get(edge.from)?.y ?? 0"
            :x2="layout.positions.get(edge.to)?.x ?? 0"
            :y2="layout.positions.get(edge.to)?.y ?? 0"
            stroke="var(--border-subtle)"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
          <text
            v-if="edge.kind === 'decom' && edgeMid(edge)"
            :x="edgeMid(edge)!.x"
            :y="edgeMid(edge)!.y"
            text-anchor="middle"
            class="fill-content-muted"
            font-size="9"
          >
            decom
          </text>
        </g>
        <g
          v-for="node in layout.nodes"
          :key="node.id"
          data-graph-node
          class="cursor-pointer"
          @click="onNodeClick(node, $event)"
          @contextmenu="onNodeContext(node, $event)"
          @mouseenter="hoveredId = node.id"
          @mouseleave="hoveredId = null"
        >
          <rect
            :x="(layout.positions.get(node.id)?.x ?? 0) - NODE_W / 2"
            :y="(layout.positions.get(node.id)?.y ?? 0) - NODE_H / 2"
            :width="NODE_W"
            :height="NODE_H"
            rx="8"
            :fill="nodeFill(node)"
            :stroke="isSelected(node) ? 'var(--accent)' : 'var(--border-subtle)'"
            :stroke-width="isSelected(node) ? 2 : 1"
          />
          <line
            :x1="(layout.positions.get(node.id)?.x ?? 0) - NODE_W / 2 + 8"
            :y1="(layout.positions.get(node.id)?.y ?? 0) - 4"
            :x2="(layout.positions.get(node.id)?.x ?? 0) + NODE_W / 2 - 8"
            :y2="(layout.positions.get(node.id)?.y ?? 0) - 4"
            stroke="var(--border-subtle)"
            stroke-width="1"
          />
          <text
            :x="layout.positions.get(node.id)?.x ?? 0"
            :y="(layout.positions.get(node.id)?.y ?? 0) - 10"
            text-anchor="middle"
            class="fill-current text-content-primary"
            font-size="11"
            :font-weight="isSelected(node) ? 600 : 500"
          >
            {{ node.name.length > 14 ? node.name.slice(0, 12) + '…' : node.name }}
          </text>
          <text
            :x="layout.positions.get(node.id)?.x ?? 0"
            :y="(layout.positions.get(node.id)?.y ?? 0) + 12"
            text-anchor="middle"
            class="fill-content-muted uppercase tracking-wide"
            font-size="9"
          >
            {{ roleLabel(node.moduleRole) }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
