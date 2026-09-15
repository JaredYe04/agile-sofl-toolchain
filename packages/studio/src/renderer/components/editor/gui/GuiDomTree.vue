<script setup lang="ts">
import type { HtmlTreeItem } from '@agile-sofl/gui'

defineOptions({ name: 'GuiDomTree' })

defineProps<{
  nodes: HtmlTreeItem[]
  selectedPath: string | null
}>()

const emit = defineEmits<{
  select: [path: string]
}>()
</script>

<template>
  <ul class="space-y-0.5">
    <li v-for="node in nodes" :key="node.path">
      <button
        type="button"
        class="w-full rounded px-1.5 py-0.5 text-left text-[11px]"
        :class="node.path === selectedPath ? 'bg-accent/15 text-accent' : 'hover:bg-surface-overlay'"
        @click.stop="emit('select', node.path)"
      >
        <span class="text-content-muted">&lt;{{ node.tag }}&gt;</span>
        {{ node.label }}
      </button>
      <GuiDomTree
        v-if="node.children.length"
        class="ml-2 border-l border-border-subtle pl-1"
        :nodes="node.children"
        :selected-path="selectedPath"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>
