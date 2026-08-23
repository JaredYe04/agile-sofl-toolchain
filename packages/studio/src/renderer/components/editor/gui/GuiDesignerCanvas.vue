<script setup lang="ts">
import { computed, inject, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { GUI_MODEL_KEY } from '../../../composables/guiModelContext'
import type { GuiWidgetKind } from '../../../preload/index'
import { defaultWidgetBounds, resolveNavigateTarget, widgetBounds } from '../../../lib/guiNavigate'

const GRID = 8
const KINDS: GuiWidgetKind[] = [
  'label',
  'text-input',
  'button',
  'checkbox',
  'select',
  'list',
  'table',
  'section',
  'navigation'
]

const props = defineProps<{ selectedViewId: string | null }>()
const emit = defineEmits<{ 'update:selectedViewId': [id: string | null] }>()

const { t } = useI18n()
const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiDesignerCanvas requires GUI_MODEL_KEY')

const runMode = ref(false)
const selectedWidgetId = ref<string | null>(null)
const dragging = ref<{
  id: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  orig: { x: number; y: number; width: number; height: number }
} | null>(null)
const liveBounds = ref<Record<string, { x: number; y: number; width: number; height: number }>>({})

function displayBounds(
  widget: { id: string; bounds?: { x: number; y: number; width: number; height: number } },
  index: number
): { x: number; y: number; width: number; height: number } {
  return liveBounds.value[widget.id] ?? widgetBounds(widget, index)
}

const screens = computed(() => gui.model.value?.screens ?? [])
const flows = computed(() => gui.model.value?.flows ?? [])
const selectedScreen = computed(() => screens.value.find((s) => s.id === props.selectedViewId) ?? null)
const canvasSize = computed(() => selectedScreen.value?.size ?? { width: 640, height: 400 })

function snap(n: number): number {
  return Math.round(n / GRID) * GRID
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
    size: { width: 640, height: 400 },
    widgets: []
  })
  emit('update:selectedViewId', id)
}

async function addWidget(kind: GuiWidgetKind, x = 24, y = 24): Promise<void> {
  const sid = props.selectedViewId
  if (!sid) return
  const index = selectedScreen.value?.widgets?.length ?? 0
  const id = newId('w')
  await gui.addWidget(sid, {
    id,
    kind,
    label: kind,
    bounds: { x: snap(x), y: snap(y), width: defaultWidgetBounds(index).width, height: 36 }
  })
  selectedWidgetId.value = id
}

function onPaletteDrop(kind: GuiWidgetKind, e: DragEvent): void {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  void addWidget(kind, e.clientX - rect.left - 8, e.clientY - rect.top - 40)
}

function startDrag(widgetId: string, mode: 'move' | 'resize', e: MouseEvent): void {
  if (runMode.value) return
  const widgets = selectedScreen.value?.widgets ?? []
  const widget = widgets.find((w) => w.id === widgetId)
  if (!widget) return
  const bounds = widgetBounds(widget, widgets.indexOf(widget))
  dragging.value = {
    id: widgetId,
    mode,
    startX: e.clientX,
    startY: e.clientY,
    orig: bounds
  }
  selectedWidgetId.value = widgetId
  window.addEventListener('mousemove', onCanvasMove)
  window.addEventListener('mouseup', endDrag)
  e.preventDefault()
  e.stopPropagation()
}

function nextDragBounds(e: MouseEvent): { x: number; y: number; width: number; height: number } | null {
  const drag = dragging.value
  if (!drag) return null
  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  return drag.mode === 'move'
    ? {
        x: snap(Math.max(0, drag.orig.x + dx)),
        y: snap(Math.max(0, drag.orig.y + dy)),
        width: drag.orig.width,
        height: drag.orig.height
      }
    : {
        x: drag.orig.x,
        y: drag.orig.y,
        width: snap(Math.max(32, drag.orig.width + dx)),
        height: snap(Math.max(24, drag.orig.height + dy))
      }
}

function onCanvasMove(e: MouseEvent): void {
  const next = nextDragBounds(e)
  const drag = dragging.value
  if (!next || !drag) return
  liveBounds.value = { ...liveBounds.value, [drag.id]: next }
}

async function endDrag(): Promise<void> {
  window.removeEventListener('mousemove', onCanvasMove)
  window.removeEventListener('mouseup', endDrag)
  const drag = dragging.value
  if (!drag) return
  const next = liveBounds.value[drag.id]
  dragging.value = null
  if (next) {
    await gui.patchById(`widget.${drag.id}.bounds`, next)
    const { [drag.id]: _removed, ...rest } = liveBounds.value
    liveBounds.value = rest
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onCanvasMove)
  window.removeEventListener('mouseup', endDrag)
})

async function onWidgetClick(widgetId: string, e: MouseEvent): Promise<void> {
  const widgets = selectedScreen.value?.widgets ?? []
  const widget = widgets.find((w) => w.id === widgetId)
  if (!widget) return
  if (runMode.value) {
    const target = resolveNavigateTarget(widget, selectedScreen.value, screens.value, flows.value)
    if (target && (widget.kind === 'button' || widget.kind === 'navigation')) {
      emit('update:selectedViewId', target)
      return
    }
  }
  selectedWidgetId.value = widgetId
  e.stopPropagation()
}

async function setNavigateTarget(widgetId: string, targetView: string): Promise<void> {
  await gui.patchById(`widget.${widgetId}.events`, [
    { on: 'click', action: 'navigate', targetView }
  ])
}

const selectedWidget = computed(() =>
  selectedScreen.value?.widgets?.find((w) => w.id === selectedWidgetId.value) ?? null
)
</script>

<template>
  <div class="flex h-full min-h-0">
    <div class="flex w-36 shrink-0 flex-col border-r border-border-subtle bg-surface-raised">
      <p class="px-2 py-1.5 text-[10px] font-semibold uppercase text-content-muted">{{ t('gui.toolbox') }}</p>
      <button
        v-for="kind in KINDS"
        :key="kind"
        type="button"
        draggable="true"
        class="mx-1 mb-1 rounded-md border border-border-subtle px-2 py-1 text-left text-[11px] text-content-secondary hover:bg-surface-overlay"
        @dragstart="($event as DragEvent).dataTransfer?.setData('text/kind', kind)"
        @click="addWidget(kind)"
      >
        {{ kind }}
      </button>
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2 py-1">
        <button
          v-for="screen in screens"
          :key="screen.id"
          type="button"
          class="rounded-md px-2 py-0.5 text-[11px]"
          :class="screen.id === props.selectedViewId ? 'bg-accent/15 text-accent' : 'text-content-secondary hover:bg-surface-overlay'"
          @click="emit('update:selectedViewId', screen.id)"
        >
          {{ screen.title ?? screen.name }}
        </button>
        <button type="button" class="rounded-md px-2 py-0.5 text-[11px] text-content-secondary hover:bg-surface-overlay" @click="addView">
          +
        </button>
        <button
          type="button"
          class="ml-auto rounded-md px-2 py-0.5 text-[11px]"
          :class="runMode ? 'bg-accent text-white' : 'text-content-secondary hover:bg-surface-overlay'"
          @click="runMode = !runMode"
        >
          {{ runMode ? t('gui.runMode') : t('gui.designMode') }}
        </button>
      </div>
      <div class="gui-preview min-h-0 flex-1 overflow-auto studio-scroll bg-gui-canvas p-4">
        <div
          class="relative mx-auto border border-gui-hairline bg-gui-surface-card shadow-sm"
          :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }"
          @dragover.prevent
          @drop="onPaletteDrop(($event.dataTransfer?.getData('text/kind') as GuiWidgetKind) || 'label', $event)"
          @click="selectedWidgetId = null"
        >
          <div
            v-for="(widget, index) in selectedScreen?.widgets ?? []"
            :key="widget.id"
            class="absolute cursor-move overflow-hidden rounded border px-2 py-1 text-xs text-gui-ink"
            :class="widget.id === selectedWidgetId ? 'border-accent bg-gui-surface-card' : 'border-gui-hairline bg-gui-surface-card/90'"
            :style="{
              left: `${displayBounds(widget, index).x}px`,
              top: `${displayBounds(widget, index).y}px`,
              width: `${displayBounds(widget, index).width}px`,
              height: `${displayBounds(widget, index).height}px`
            }"
            @mousedown="startDrag(widget.id, 'move', $event)"
            @click="onWidgetClick(widget.id, $event)"
          >
            <span v-if="widget.kind === 'button' || widget.kind === 'navigation'" class="inline-flex h-full items-center">{{ widget.label }}</span>
            <span v-else-if="widget.kind === 'text-input'" class="block w-full rounded border border-gui-hairline px-1">{{ widget.label }}</span>
            <span v-else>{{ widget.label ?? widget.kind }}</span>
            <span
              v-if="!runMode && widget.id === selectedWidgetId"
              class="absolute bottom-0 right-0 h-2 w-2 cursor-nwse-resize bg-accent"
              @mousedown.stop="startDrag(widget.id, 'resize', $event)"
            />
          </div>
        </div>
      </div>
      <div v-if="selectedWidget && !runMode" class="shrink-0 border-t border-border-subtle px-3 py-2 text-[11px]">
        <label class="mr-2 text-content-muted">{{ t('gui.navigateTo') }}</label>
        <select
          class="rounded border border-border-subtle bg-surface-raised px-1 py-0.5"
          :value="selectedWidget.events?.find((e) => e.action === 'navigate')?.targetView ?? ''"
          @change="setNavigateTarget(selectedWidget.id, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">—</option>
          <option v-for="screen in screens" :key="screen.id" :value="screen.id">{{ screen.name }}</option>
        </select>
      </div>
    </div>
  </div>
</template>
