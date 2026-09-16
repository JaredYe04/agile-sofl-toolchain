<script setup lang="ts">
import { useWorkspaceStore, type WorkspacePanelId } from '../../stores/workspace'

const props = defineProps<{ panel: WorkspacePanelId }>()
const workspace = useWorkspaceStore()

function activate(): void {
  workspace.setFocusedPanel(props.panel)
}
</script>

<template>
  <div
    class="workspace-panel h-full min-h-0 min-w-0"
    @pointerdown="activate"
    @focusin="activate"
  >
    <slot />
  </div>
</template>
