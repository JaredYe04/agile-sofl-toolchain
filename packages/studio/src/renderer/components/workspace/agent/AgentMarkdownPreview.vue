<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { vditorCdn, vditorContentTheme } from '../../../lib/vditorCdn'

const props = defineProps<{ markdown: string }>()

const host = ref<HTMLDivElement | null>(null)
let renderSeq = 0

async function renderPreview(): Promise<void> {
  const el = host.value
  if (!el) return
  const seq = ++renderSeq
  el.innerHTML = ''
  await Vditor.preview(el, props.markdown, {
    cdn: vditorCdn(),
    theme: { current: vditorContentTheme() },
    markdown: { toc: false, mark: true },
    speech: { enable: false },
    anchor: 0
  })
  if (seq !== renderSeq) return
}

function scheduleRender(): void {
  void nextTick(() => renderPreview())
}

watch(() => props.markdown, scheduleRender)

let themeObserver: MutationObserver | null = null

onMounted(() => {
  scheduleRender()
  themeObserver = new MutationObserver(scheduleRender)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = null
  renderSeq++
  if (host.value) host.value.innerHTML = ''
})
</script>

<template>
  <div
    ref="host"
    class="agent-markdown-preview studio-text-selectable informal-vditor studio-scroll min-w-0 max-w-full cursor-text text-[13px] leading-relaxed"
  />
</template>

<style scoped>
.agent-markdown-preview :deep(.vditor-reset) {
  padding: 0;
  font-size: 13px !important;
  line-height: 1.625 !important;
  color: var(--text-primary);
  background: transparent;
}

.agent-markdown-preview :deep(.vditor-reset p),
.agent-markdown-preview :deep(.vditor-reset li),
.agent-markdown-preview :deep(.vditor-reset blockquote),
.agent-markdown-preview :deep(.vditor-reset td),
.agent-markdown-preview :deep(.vditor-reset th) {
  font-size: 13px !important;
  line-height: 1.625 !important;
}

.agent-markdown-preview :deep(.vditor-reset h1) {
  font-size: 15px;
  line-height: 1.4;
  margin: 0.6em 0 0.35em;
}

.agent-markdown-preview :deep(.vditor-reset h2) {
  font-size: 14px;
  line-height: 1.45;
  margin: 0.55em 0 0.3em;
}

.agent-markdown-preview :deep(.vditor-reset h3),
.agent-markdown-preview :deep(.vditor-reset h4),
.agent-markdown-preview :deep(.vditor-reset h5),
.agent-markdown-preview :deep(.vditor-reset h6) {
  font-size: 13px;
  line-height: 1.5;
  margin: 0.5em 0 0.25em;
}

.agent-markdown-preview :deep(.vditor-reset pre) {
  margin: 0.45em 0;
  font-size: 12px;
  line-height: 1.5;
}

.agent-markdown-preview :deep(.vditor-reset code:not(pre code)) {
  font-size: 12px;
}

.agent-markdown-preview :deep(.vditor-reset p) {
  margin: 0.35em 0;
}

.agent-markdown-preview :deep(.vditor-reset ul),
.agent-markdown-preview :deep(.vditor-reset ol) {
  margin: 0.35em 0;
  padding-left: 1.25em;
}

.agent-markdown-preview :deep(.vditor-reset > :first-child) {
  margin-top: 0;
}

.agent-markdown-preview :deep(.vditor-reset > :last-child) {
  margin-bottom: 0;
}
</style>
