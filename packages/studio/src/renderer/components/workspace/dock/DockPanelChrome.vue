<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore, type WorkspacePanelId } from '../../../stores/workspace'
import IconActionButton from '../../ui/IconActionButton.vue'

const props = defineProps<{
  title: string
  dirty?: boolean
  panel?: WorkspacePanelId
}>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const isFullscreen = computed(() => Boolean(props.panel && workspace.fullscreenPanel === props.panel))

function toggleFullscreen(): void {
  if (!props.panel) return
  workspace.toggleFullscreenPanel(props.panel)
}
</script>

<template>
  <header
    class="relative z-[110] flex h-[32px] min-w-0 shrink-0 flex-nowrap items-center gap-1 overflow-hidden border-b border-border-subtle bg-surface-base px-2"
  >
    <slot name="title">
      <h2 class="min-w-0 truncate text-xs font-semibold text-content-primary">{{ title }}</h2>
      <span v-if="dirty" class="shrink-0 text-[10px] text-accent">●</span>
    </slot>
    <div class="ml-auto flex shrink-0 items-center gap-1">
      <slot name="actions" />
      <IconActionButton
        v-if="panel"
        :icon="isFullscreen ? 'lucide:x' : 'lucide:maximize-2'"
        :label="isFullscreen ? t('workspace.exitFullscreen') : t('workspace.fullscreen')"
        @click="toggleFullscreen"
      />
    </div>
  </header>
</template>
