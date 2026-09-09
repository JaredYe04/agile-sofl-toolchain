<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '../../stores/workspace'
import { nestedNodes } from '../../composables/useInformalSpec'
import { VISUAL_MODEL_KEY } from '../../composables/visualModelContext'
import type { InformalNodePayload, InformalSpecPayload } from '../../../preload/index'
import { useInformalSpec } from '../../composables/useInformalSpec'

const { t } = useI18n()
const workspace = useWorkspaceStore()
const visual = inject(VISUAL_MODEL_KEY, null)
const informal = useInformalSpec(computed(() => workspace.informalTab?.id))

type Row = { id: string; title: string; kind: 'section' | 'informal' | 'hybrid'; depth: number; hybridName?: string }

const rows = computed(() => {
  const out: Row[] = []
  const spec = informal.spec.value
  if (spec) {
    out.push({ id: 'informal-root', title: t('workspace.informalSpec'), kind: 'section', depth: 0 })
    for (const section of spec.sections) {
      out.push({ id: section.id, title: section.title, kind: 'section', depth: 1 })
      const walk = (nodes: InformalNodePayload[], depth: number) => {
        for (const node of nodes) {
          out.push({ id: node.id, title: node.title, kind: 'informal', depth })
          walk(nestedNodes(node), depth + 1)
        }
      }
      walk(section.children as InformalSpecPayload['sections'][0]['children'], 2)
    }
  }
  const modules = visual?.model.value?.modules ?? []
  if (modules.length) {
    out.push({ id: 'hybrid-root', title: t('workspace.hybridSpec'), kind: 'section', depth: 0 })
    for (const mod of modules) {
      out.push({ id: `hy-${mod.name}`, title: mod.name, kind: 'hybrid', depth: 1, hybridName: mod.name })
      for (const p of mod.processes) {
        out.push({
          id: `hy-${mod.name}-p-${p.name}`,
          title: p.name,
          kind: 'hybrid',
          depth: 2,
          hybridName: mod.name
        })
      }
    }
  }
  return out
})

function onClick(row: Row): void {
  if (row.kind === 'informal') {
    workspace.informalSelectedNodeId = row.id
    workspace.informalViewMode = 'document'
  }
  if (row.kind === 'hybrid' && row.hybridName) {
    const isProcess = row.id.includes('-p-')
    workspace.selectModule(
      row.hybridName,
      isProcess
        ? { kind: 'process', moduleName: row.hybridName, processName: row.title }
        : { kind: 'module', moduleName: row.hybridName }
    )
  }
}
</script>

<template>
  <div class="h-full overflow-auto p-2 studio-scroll">
    <p v-if="!rows.length" class="px-2 py-3 text-center text-[11px] text-content-muted">—</p>
    <button
      v-for="row in rows"
      :key="row.id"
      type="button"
      class="flex w-full rounded-md px-2 py-1 text-left text-[12px]"
      :class="
        workspace.informalSelectedNodeId === row.id ||
        (row.hybridName && workspace.selectedModuleName === row.hybridName && row.kind === 'hybrid' && !row.id.includes('-p-'))
          ? 'bg-accent/15 text-accent'
          : row.kind === 'section'
            ? 'font-semibold text-content-muted'
            : 'text-content-primary hover:bg-surface-overlay'
      "
      :style="{ paddingLeft: `${8 + row.depth * 12}px` }"
      @click="onClick(row)"
    >
      {{ row.title }}
    </button>
  </div>
</template>
