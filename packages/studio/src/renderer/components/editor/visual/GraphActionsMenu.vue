<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ModuleGraphLayoutPayload } from '../../../../preload/index'
import {
  graphExportStyleBlock,
  graphThemeVars
} from '../../../lib/graphExportTokens'
import SelectField from './ui/SelectField.vue'

const props = defineProps<{
  layout: ModuleGraphLayoutPayload | null
  svgRef: SVGSVGElement | null
}>()

const emit = defineEmits<{
  tidy: []
}>()

const { t } = useI18n()
const open = ref(false)
const exportTheme = ref<'current' | 'light' | 'dark'>('current')
const exportScale = ref(1)

const scaleOptions = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' }
]

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function cloneSvgForExport(): SVGSVGElement | null {
  const src = props.svgRef
  if (!src) return null
  const clone = src.cloneNode(true) as SVGSVGElement
  const viewportG = clone.querySelector('g[transform]')
  if (viewportG) viewportG.removeAttribute('transform')
  const bbox = props.layout?.bbox
  const pad = 24
  let vbX = 0
  let vbY = 0
  let vbW = 800
  let vbH = 600
  if (bbox) {
    vbX = bbox.minX - pad
    vbY = bbox.minY - pad
    vbW = bbox.maxX - bbox.minX + pad * 2
    vbH = bbox.maxY - bbox.minY + pad * 2
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
    clone.setAttribute('width', String(vbW))
    clone.setAttribute('height', String(vbH))
  }
  const vars = graphThemeVars(exportTheme.value)
  let style = clone.querySelector('style')
  if (!style) {
    style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    clone.insertBefore(style, clone.firstChild)
  }
  style.textContent = graphExportStyleBlock(vars)
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', String(vbX))
  bg.setAttribute('y', String(vbY))
  bg.setAttribute('width', String(vbW))
  bg.setAttribute('height', String(vbH))
  bg.setAttribute('fill', vars['--surface-base']?.trim() || '#f3f3f3')
  clone.insertBefore(bg, style.nextSibling)
  return clone
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportSvg(): void {
  const clone = cloneSvgForExport()
  if (!clone) return
  const xml = new XMLSerializer().serializeToString(clone)
  downloadBlob(new Blob([xml], { type: 'image/svg+xml' }), 'module-graph.svg')
  close()
}

async function exportPng(): Promise<void> {
  const clone = cloneSvgForExport()
  if (!clone) return
  const vars = graphThemeVars(exportTheme.value)
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = url
  })
  const w = Number(clone.getAttribute('width') ?? 800)
  const h = Number(clone.getAttribute('height') ?? 600)
  const scale = exportScale.value
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = vars['--surface-base']?.trim() || '#f3f3f3'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'module-graph.png')
    close()
  }, 'image/png')
}

function onTidy(): void {
  emit('tidy')
  close()
}
</script>

<template>
  <div
    data-graph-ui
    class="pointer-events-auto absolute left-2 top-2 z-20"
    @pointerdown.stop
    @click.stop
    @wheel.stop
  >
    <button
      type="button"
      class="rounded-lg border border-border-subtle bg-surface-raised/95 px-2 py-1 text-xs shadow-sm backdrop-blur-sm hover:bg-surface-overlay"
      @click="toggle"
    >
      {{ t('visual.graphActions.menu') }}
    </button>
    <div
      v-if="open"
      class="mt-1 min-w-[200px] rounded-lg border border-border-subtle bg-surface-raised/98 p-2 text-xs shadow-lg backdrop-blur-sm"
    >
      <p class="mb-1 font-medium text-content-secondary">{{ t('visual.graphActions.export') }}</p>
      <label class="mb-1 block space-y-1">
        <span class="text-content-secondary">{{ t('visual.graphActions.theme') }}</span>
        <SelectField
          v-model="exportTheme"
          size="sm"
          :options="[
            { value: 'current', label: t('visual.graphActions.themeCurrent') },
            { value: 'light', label: t('visual.graphActions.themeLight') },
            { value: 'dark', label: t('visual.graphActions.themeDark') }
          ]"
        />
      </label>
      <label class="mb-2 block space-y-1">
        <span class="text-content-secondary">{{ t('visual.graphActions.scale') }}</span>
        <SelectField v-model="exportScale" size="sm" :options="scaleOptions" />
      </label>
      <button
        type="button"
        class="mb-1 w-full rounded px-2 py-1 text-left hover:bg-surface-overlay"
        @click="exportSvg"
      >
        {{ t('visual.graphActions.exportSvg') }}
      </button>
      <button
        type="button"
        class="mb-2 w-full rounded px-2 py-1 text-left hover:bg-surface-overlay"
        @click="exportPng"
      >
        {{ t('visual.graphActions.exportPng') }}
      </button>
      <hr class="my-1 border-border-subtle" />
      <button type="button" class="w-full rounded px-2 py-1 text-left hover:bg-surface-overlay" @click="onTidy">
        {{ t('visual.graphActions.tidy') }}
      </button>
    </div>
  </div>
</template>
