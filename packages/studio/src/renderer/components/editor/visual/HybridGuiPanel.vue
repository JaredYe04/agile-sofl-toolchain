<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SerializableSpan, VisualGuiBlock, VisualModuleSummary } from '../../../preload/index'

const props = defineProps<{
  gui: VisualGuiBlock
  module: VisualModuleSummary
  disabled?: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: SerializableSpan]
  patchWidget: [payload: { screenName: string; widgetName: string; text: string }]
}>()

const { t } = useI18n()
const expandedScreens = ref<Set<string>>(new Set(props.gui.screens.map((s) => s.name)))

function toggleScreen(name: string): void {
  const next = new Set(expandedScreens.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  expandedScreens.value = next
}

function onTextBlur(screenName: string, widgetName: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  emit('patchWidget', { screenName, widgetName, text: value })
}
</script>

<template>
  <section class="rounded-lg border border-border-subtle bg-surface-raised p-4">
    <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.gui') }}</h3>
    <button
      type="button"
      class="mb-3 text-sm text-accent hover:underline"
      @click="emit('revealSpan', gui.span)"
    >
      {{ gui.name }}
    </button>
    <ul class="space-y-2">
      <li v-for="screen in gui.screens" :key="screen.name" class="rounded border border-border-subtle">
        <button
          type="button"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-content-primary hover:bg-surface-overlay"
          @click="toggleScreen(screen.name)"
        >
          <span>{{ screen.name }}</span>
          <span class="opacity-60">{{ expandedScreens.has(screen.name) ? '▾' : '▸' }}</span>
        </button>
        <ul v-if="expandedScreens.has(screen.name)" class="space-y-2 border-t border-border-subtle px-3 py-2">
          <li
            v-for="widget in screen.widgets"
            :key="widget.name"
            class="space-y-1 rounded-md bg-surface-base p-2"
          >
            <div class="flex items-center gap-2 text-xs text-content-secondary">
              <span class="rounded bg-surface-overlay px-1.5 py-0.5 uppercase">{{ widget.kind }}</span>
              <button type="button" class="hover:text-accent" @click="emit('revealSpan', widget.span)">
                {{ widget.name }}
              </button>
              <span v-if="widget.triggersProcess" class="opacity-70">
                → {{ widget.triggersProcess }}
              </span>
            </div>
            <input
              :value="widget.text"
              type="text"
              class="w-full rounded border border-border-subtle bg-surface-raised px-2 py-1 text-sm text-content-primary"
              :disabled="disabled"
              @blur="onTextBlur(screen.name, widget.name, $event)"
            />
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
