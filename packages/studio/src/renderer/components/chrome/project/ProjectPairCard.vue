<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Badge from '../../editor/visual/ui/Badge.vue'
import { basename, pairCompleteness, type ProjectPair } from '../../../composables/useProjectScan'
import { filePathsEqual } from '../../../stores/tabUtils'

const props = defineProps<{
  pair: ProjectPair
  activePath?: string | null
  expanded?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  openFile: [path: string]
  contextmenu: [event: MouseEvent, path?: string]
}>()

const { t } = useI18n()

const title = computed(() => basename(props.pair.aspecPath).replace(/\.aspec$/, ''))
const status = computed(() => pairCompleteness(props.pair))

const statusLabel = computed(() => {
  if (status.value === 'full') return t('sidebar.status.full')
  if (status.value === 'partial') return t('sidebar.status.partial')
  return t('sidebar.status.informalOnly')
})

const statusClass = computed(() => {
  if (status.value === 'full') return 'bg-semantic-success/15 text-semantic-success'
  if (status.value === 'partial') return 'bg-semantic-warning/15 text-semantic-warning'
  return 'bg-surface-base text-content-muted'
})

const isPairActive = computed(() => {
  const p = props.activePath
  if (!p) return false
  return (
    filePathsEqual(p, props.pair.aspecPath) ||
    (props.pair.asflPath && filePathsEqual(p, props.pair.asflPath)) ||
    (props.pair.guispecPath && filePathsEqual(p, props.pair.guispecPath))
  )
})

function isActive(path?: string): boolean {
  if (!path || !props.activePath) return false
  return filePathsEqual(props.activePath, path)
}

function onRowContext(e: MouseEvent, path?: string): void {
  e.preventDefault()
  e.stopPropagation()
  emit('contextmenu', e, path)
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-border-subtle bg-surface-raised transition-colors"
    :class="isPairActive ? 'border-l-2 border-l-accent' : ''"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-overlay"
      @click="emit('toggle')"
      @contextmenu="onRowContext($event)"
    >
      <svg
        class="h-3.5 w-3.5 shrink-0 text-content-muted transition-transform"
        :class="expanded ? 'rotate-90' : ''"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
          clip-rule="evenodd"
        />
      </svg>
      <span class="min-w-0 flex-1 truncate text-sm font-medium text-content-primary">{{ title }}</span>
      <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium" :class="statusClass">
        {{ statusLabel }}
      </span>
    </button>

    <div v-if="expanded" class="border-t border-border-subtle px-2 py-1.5">
      <button
        v-if="pair.aspecPath"
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-overlay"
        :class="isActive(pair.aspecPath) ? 'bg-accent/10 text-content-primary' : 'text-content-secondary'"
        @click="emit('openFile', pair.aspecPath)"
        @contextmenu="onRowContext($event, pair.aspecPath)"
      >
        <Badge variant="semi-formal">.aspec</Badge>
        <span class="truncate">{{ basename(pair.aspecPath) }}</span>
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-overlay"
        :class="
          pair.asflPath
            ? isActive(pair.asflPath)
              ? 'bg-accent/10 text-content-primary'
              : 'text-content-secondary'
            : 'text-content-muted'
        "
        :disabled="!pair.asflPath"
        @click="pair.asflPath && emit('openFile', pair.asflPath)"
        @contextmenu="pair.asflPath && onRowContext($event, pair.asflPath)"
      >
        <Badge variant="formal">.asfl</Badge>
        <span class="truncate">{{ pair.asflPath ? basename(pair.asflPath) : t('sidebar.file.missing') }}</span>
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-overlay"
        :class="
          pair.guispecPath
            ? isActive(pair.guispecPath)
              ? 'bg-accent/10 text-content-primary'
              : 'text-content-secondary'
            : 'text-content-muted'
        "
        :disabled="!pair.guispecPath"
        @click="pair.guispecPath && emit('openFile', pair.guispecPath)"
        @contextmenu="pair.guispecPath && onRowContext($event, pair.guispecPath)"
      >
        <Badge variant="neutral">.guispec</Badge>
        <span class="truncate">{{
          pair.guispecPath ? basename(pair.guispecPath) : t('sidebar.file.missing')
        }}</span>
      </button>
    </div>
  </div>
</template>
