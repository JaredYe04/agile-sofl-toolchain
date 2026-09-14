<script setup lang="ts">
import { computed, ref, shallowRef, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type DockNode,
  type DockPanelId,
  type DockZone,
  dockPanel,
  dockZoneFromPoint,
  updateSplitRatioAtPath
} from '../../../lib/dockLayout'
import { useWorkspaceStore } from '../../../stores/workspace'
import DockLayoutPreview from './DockLayoutPreview.vue'
import WorkspaceDockNode from './WorkspaceDockNode.vue'

const { t } = useI18n()
const workspace = useWorkspaceStore()

const dragPanel = ref<DockPanelId | null>(null)
const hoverTarget = ref<DockPanelId | null>(null)
const hoverZone = ref<DockZone | null>(null)
const previewLayout = shallowRef<DockNode | null>(null)
const hostRef = ref<HTMLElement | null>(null)

const layout = computed({
  get: () => workspace.dockLayout,
  set: (v: DockNode) => workspace.setDockLayout(v)
})

function panelTitle(id: DockPanelId): string {
  if (id === 'informal') return t('workspace.informalSpec')
  if (id === 'agent') return t('agent.title')
  return t('workspace.hybridSpec')
}

function onRatio(path: number[], ratio: number): void {
  layout.value = updateSplitRatioAtPath(layout.value, path, ratio)
}

function hitPanel(clientX: number, clientY: number): DockPanelId | null {
  const el = document.elementFromPoint(clientX, clientY)
  let cur: Element | null = el
  while (cur) {
    const id = cur.getAttribute?.('data-dock-host')
    if (id === 'informal' || id === 'agent' || id === 'hybrid') return id
    cur = cur.parentElement
  }
  return null
}

function hitZone(panel: DockPanelId, clientX: number, clientY: number): DockZone | null {
  const el = hostRef.value?.querySelector(`[data-dock-host="${panel}"]`)
  if (!el) return null
  return dockZoneFromPoint(el.getBoundingClientRect(), clientX, clientY)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragPanel.value) return
  const target = hitPanel(e.clientX, e.clientY)
  hoverTarget.value = target
  if (!target || target === dragPanel.value) {
    hoverZone.value = null
    previewLayout.value = null
    return
  }
  const zone = hitZone(target, e.clientX, e.clientY)
  hoverZone.value = zone
  previewLayout.value =
    zone && dragPanel.value ? dockPanel(layout.value, dragPanel.value, target, zone) : null
}

function endDrag(e: PointerEvent): void {
  if (dragPanel.value && hoverTarget.value && hoverZone.value && dragPanel.value !== hoverTarget.value) {
    const next = dockPanel(layout.value, dragPanel.value, hoverTarget.value, hoverZone.value)
    if (next) layout.value = next
  }
  dragPanel.value = null
  hoverTarget.value = null
  hoverZone.value = null
  previewLayout.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
}

function onDragStart(panel: DockPanelId, e: PointerEvent): void {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('button, input, textarea, select, a, [data-dock-no-drag]')) return
  e.preventDefault()
  dragPanel.value = panel
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
})

function panelDirty(id: DockPanelId): boolean {
  if (id === 'informal') return workspace.isInformalDirty()
  if (id === 'hybrid') return workspace.isHybridDirty()
  return false
}
</script>

<template>
  <div ref="hostRef" class="relative h-full min-h-0 w-full min-w-0 bg-surface-base">
    <WorkspaceDockNode
      :node="layout"
      :path="[]"
      :drag-panel="dragPanel"
      :hover-target="hoverTarget"
      :hover-zone="hoverZone"
      :panel-title="panelTitle"
      :panel-dirty="panelDirty"
      @drag-start="onDragStart"
      @ratio="onRatio"
    />
    <div
      v-if="dragPanel && previewLayout"
      class="pointer-events-none absolute inset-2 z-30 rounded-lg bg-black/20 p-2 backdrop-blur-[1px] dark:bg-black/35"
    >
      <DockLayoutPreview :node="previewLayout" />
    </div>
  </div>
</template>
