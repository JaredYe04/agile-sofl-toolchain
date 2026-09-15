<script setup lang="ts">
import { presetById, type WorkspaceLayoutPresetId } from '../../lib/workspaceLayout'
import LayoutMiniPreviewNode from './LayoutMiniPreviewNode.vue'

defineProps<{ presetId: WorkspaceLayoutPresetId }>()
</script>

<template>
  <LayoutMiniPreviewNode :topo="presetById(presetId).topology" />
</template>
