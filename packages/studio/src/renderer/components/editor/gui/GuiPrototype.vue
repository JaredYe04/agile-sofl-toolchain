<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { prototypeStylesheet, sanitizeHtml } from '@agile-sofl/gui'
import {
  applyEnv,
  collectEnv,
  pathOfElement,
  readThemeVars,
  showScreen,
  type GuiProcessEvent
} from '../../../lib/guiPrototype'

const props = defineProps<{
  html: string
  screenId?: string | null
  interactive?: boolean
}>()

const emit = defineEmits<{
  navigate: [id: string]
  process: [event: GuiProcessEvent]
  select: [payload: { id: string | null; path: string | null }]
}>()

const host = ref<HTMLDivElement | null>(null)
let shadow: ShadowRoot | null = null

function mountHtml(): void {
  const el = host.value
  if (!el) return
  if (!shadow) shadow = el.attachShadow({ mode: 'open' })
  const css = prototypeStylesheet(readThemeVars())
  shadow.innerHTML = `<style>${css}</style>${sanitizeHtml(props.html || '')}`
  if (props.screenId) showScreen(shadow, props.screenId)
  shadow.addEventListener('click', onClick)
}

function onClick(event: Event): void {
  const target = event.target as HTMLElement | null
  if (!target || !shadow) return
  const hit = target.closest('[data-process], [data-nav], [id], [data-screen], [data-bind]') as HTMLElement | null
  const path = pathOfElement(hit ?? target, shadow)
  emit('select', {
    id: hit?.id || hit?.getAttribute('data-id') || hit?.getAttribute('data-screen') || null,
    path
  })
  if (!props.interactive) return
  const process = hit?.getAttribute('data-process') || hit?.closest('[data-screen]')?.getAttribute('data-process')
  const nav = hit?.getAttribute('data-nav') || undefined
  const screen = hit?.closest('[data-screen]')?.getAttribute('data-screen') || undefined
  if (process) {
    event.preventDefault()
    emit('process', { process, env: collectEnv(shadow), nav, screen })
    return
  }
  if (nav) {
    event.preventDefault()
    emit('navigate', nav)
  }
}

watch(
  () => [props.html, props.screenId],
  () => {
    if (!shadow) return
    const css = prototypeStylesheet(readThemeVars())
    shadow.innerHTML = `<style>${css}</style>${sanitizeHtml(props.html || '')}`
    if (props.screenId) showScreen(shadow, props.screenId)
  }
)

onMounted(() => mountHtml())
onBeforeUnmount(() => {
  shadow?.removeEventListener('click', onClick)
})

defineExpose({
  applyOutputs(env: Record<string, string | number | boolean | null>) {
    if (shadow) applyEnv(shadow, env)
  }
})
</script>

<template>
  <div class="studio-scroll h-full min-h-[240px] min-w-0 overflow-auto bg-[var(--surface-base)]">
    <div ref="host" class="gui-prototype-host min-h-full w-full" />
  </div>
</template>
