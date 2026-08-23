<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { elbowPath, layoutHierarchyForest, NODE_H } from '../../lib/hierarchyTreeLayout'

const workspace = useWorkspaceStore()
const containerRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(180)
let observer: ResizeObserver | null = null

onMounted(() => {
  const el = containerRef.value
  if (!el) return
  viewportWidth.value = el.clientWidth || 180
  observer = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width
    if (w && Math.abs(w - viewportWidth.value) > 1) viewportWidth.value = w
  })
  observer.observe(el)
})

onUnmounted(() => observer?.disconnect())

const layout = computed(() => layoutHierarchyForest(workspace.modules, viewportWidth.value))

function truncate(text: string, nodeW: number): string {
  const maxChars = Math.max(4, Math.floor((nodeW - 8) / 6.2))
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`
}
</script>

<template>
  <div ref="containerRef" class="h-full min-h-0 w-full overflow-auto studio-scroll bg-surface-base">
    <p v-if="!layout.nodes.length" class="px-2 py-3 text-center text-[11px] text-content-muted">—</p>
    <svg
      v-else
      :width="layout.width"
      :height="layout.height"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      class="block max-w-full"
    >
      <path
        v-for="(link, i) in layout.links"
        :key="i"
        :d="elbowPath(link.from, link.to)"
        fill="none"
        class="stroke-current text-content-muted"
        stroke-width="1.25"
      />
      <g
        v-for="node in layout.nodes"
        :key="node.name"
        class="cursor-pointer"
        @click="workspace.selectModule(node.name)"
      >
        <rect
          :x="node.x - node.w / 2"
          :y="node.y - NODE_H / 2"
          :width="node.w"
          :height="NODE_H"
          rx="5"
          :class="
            workspace.selectedModuleName === node.name
              ? 'fill-accent'
              : node.isGui
                ? 'fill-accent/25'
                : node.isSystem
                  ? 'fill-[#1e4d8c]'
                  : 'fill-surface-overlay'
          "
          class="stroke-current text-border-subtle"
          stroke-width="1"
        />
        <text
          :x="node.x"
          :y="node.y + 3.5"
          text-anchor="middle"
          class="pointer-events-none text-[10px]"
          :class="
            workspace.selectedModuleName === node.name || node.isSystem
              ? 'fill-white'
              : 'fill-current text-content-primary'
          "
        >
          {{ truncate(node.displayName, node.w) }}
        </text>
      </g>
    </svg>
  </div>
</template>
