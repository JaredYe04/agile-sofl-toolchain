<script setup lang="ts">
import type { GuiScreenDto, GuiWidgetKind } from '../../../preload/index'

const props = defineProps<{
  screen: GuiScreenDto | null
}>()

const kindBadge: Record<GuiWidgetKind, string> = {
  label: 'gui-timeline-read',
  'text-input': 'gui-timeline-edit',
  button: 'gui-timeline-thinking',
  checkbox: 'gui-timeline-grep',
  select: 'gui-timeline-edit',
  list: 'gui-timeline-read',
  table: 'gui-timeline-read',
  section: 'gui-timeline-done',
  navigation: 'gui-timeline-grep'
}
</script>

<template>
  <div class="gui-preview flex h-full flex-col overflow-hidden bg-gui-canvas p-6">
    <div v-if="!screen" class="flex flex-1 items-center justify-center text-sm text-gui-body">
      {{ $t('gui.selectScreen') }}
    </div>
    <div v-else class="mx-auto w-full max-w-md flex-1 overflow-y-auto studio-scroll">
      <div class="rounded-lg border border-gui-hairline bg-gui-surface-card p-6">
        <h1 class="text-[22px] font-normal tracking-tight text-gui-ink">{{ screen.title ?? screen.name }}</h1>
        <p v-if="screen.description" class="mt-2 text-sm text-gui-body">{{ screen.description.trim().split('\n')[0] }}</p>
        <div class="mt-6 space-y-4">
          <div v-for="w in screen.widgets ?? []" :key="w.id" class="space-y-1">
            <span
              class="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gui-ink"
              :class="kindBadge[w.kind] ?? 'bg-gui-hairline'"
            >
              {{ w.kind }}
            </span>
            <div v-if="w.kind === 'label'" class="text-base text-gui-ink">{{ w.label }}</div>
            <div v-else-if="w.kind === 'text-input'" class="space-y-1">
              <label class="text-sm text-gui-body">{{ w.label }}</label>
              <div class="h-11 rounded-md border border-gui-hairline bg-gui-surface-card px-4 text-sm text-gui-muted">
                {{ w.binds?.param ?? '…' }}
              </div>
            </div>
            <div v-else-if="w.kind === 'button'">
              <button
                type="button"
                class="h-10 rounded-md bg-gui-primary px-[18px] text-sm font-medium text-white"
              >
                {{ w.label ?? w.action ?? 'Button' }}
              </button>
            </div>
            <div v-else-if="w.kind === 'section'" class="border-t border-gui-hairline pt-3 text-sm font-semibold text-gui-ink">
              {{ w.label }}
            </div>
            <div v-else class="rounded-md border border-gui-hairline bg-gui-canvas-soft px-3 py-2 text-sm text-gui-body">
              {{ w.label ?? w.kind }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gui-timeline-thinking { background-color: var(--gui-timeline-thinking); }
.gui-timeline-grep { background-color: var(--gui-timeline-grep); }
.gui-timeline-read { background-color: var(--gui-timeline-read); }
.gui-timeline-edit { background-color: var(--gui-timeline-edit); }
.gui-timeline-done { background-color: var(--gui-timeline-done); }
</style>
