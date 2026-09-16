<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { nestedNodes } from '../../composables/useInformalSpec'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import type { InformalNodePayload, InformalSpecPayload } from '../../../preload/index'
import type { TreeSelection } from '../../composables/useVisualModel'

const props = defineProps<{ pane: 'informal' | 'hybrid'; spec?: InformalSpecPayload | null }>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)

type Row = {
  id: string
  title: string
  kind: 'section' | 'informal' | 'hybrid'
  depth: number
  hybridName?: string
  selection?: Exclude<TreeSelection, null>
}

const rows = computed(() => {
  const out: Row[] = []
  if (props.pane === 'informal') {
    const spec = props.spec
    const sections = Array.isArray(spec?.sections) ? spec.sections : []
    for (const section of sections) {
      out.push({ id: section.id, title: section.title, kind: 'section', depth: 0 })
      const walk = (nodes: InformalNodePayload[], depth: number) => {
        for (const node of nodes) {
          out.push({ id: node.id, title: node.title, kind: 'informal', depth })
          walk(nestedNodes(node), depth + 1)
        }
      }
      walk(Array.isArray(section.children) ? section.children : [], 1)
    }
    return out
  }
  const modules = Array.isArray(visual?.model.value?.modules) ? visual.model.value.modules : []
  for (const mod of modules) {
    out.push({
      id: `hy-${mod.name}`,
      title: mod.isSystem ? `SYSTEM_${mod.name}` : mod.name,
      kind: 'hybrid',
      depth: 0,
      hybridName: mod.name,
      selection: { kind: 'module', moduleName: mod.name }
    })
    for (const p of mod.processes) {
      out.push({
        id: `hy-${mod.name}-p-${p.name}`,
        title: p.name,
        kind: 'hybrid',
        depth: 1,
        hybridName: mod.name,
        selection: { kind: 'process', moduleName: mod.name, processName: p.name }
      })
    }
    for (const fn of mod.functions) {
      out.push({
        id: `hy-${mod.name}-f-${fn.name}`,
        title: fn.name,
        kind: 'hybrid',
        depth: 1,
        hybridName: mod.name,
        selection: { kind: 'function', moduleName: mod.name, functionName: fn.name }
      })
    }
  }
  return out
})

function isSelected(row: Row): boolean {
  if (row.kind === 'informal' || row.kind === 'section') {
    return workspace.informalSelectedNodeId === row.id
  }
  const sel = workspace.selection
  if (!sel || !row.selection) return false
  if (sel.kind !== row.selection.kind || sel.moduleName !== row.selection.moduleName) return false
  if (sel.kind === 'process' && row.selection.kind === 'process') {
    return sel.processName === row.selection.processName
  }
  if (sel.kind === 'function' && row.selection.kind === 'function') {
    return sel.functionName === row.selection.functionName
  }
  return sel.kind === 'module'
}

function onClick(row: Row): void {
  if (row.kind === 'informal' || row.kind === 'section') {
    workspace.revealInformalInDocument(row.id)
    return
  }
  if (row.kind === 'hybrid' && row.hybridName && row.selection) {
    workspace.revealHybridInCode(row.hybridName, row.selection)
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header
      class="flex h-7 shrink-0 items-center border-b border-border-subtle px-2"
    >
      <h3 class="truncate text-[11px] font-semibold text-content-muted">
        {{ pane === 'informal' ? t('workspace.informalSpec') : t('workspace.hybridSpec') }}
      </h3>
    </header>
    <div class="min-h-0 flex-1 overflow-auto p-2 studio-scroll">
      <p v-if="!rows.length" class="px-2 py-3 text-center text-[11px] text-content-muted">—</p>
      <button
        v-for="row in rows"
        :key="row.id"
        type="button"
        class="flex w-full rounded-md px-2 py-1 text-left text-[12px]"
        :class="
          isSelected(row)
            ? 'bg-accent/15 text-accent'
            : row.kind === 'section'
              ? 'font-semibold text-content-muted hover:bg-surface-overlay'
              : 'text-content-primary hover:bg-surface-overlay'
        "
        :style="{ paddingLeft: `${8 + row.depth * 12}px` }"
        @click="onClick(row)"
      >
        {{ row.title }}
      </button>
    </div>
  </div>
</template>
