<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DockPanelId, DockZone } from '../../lib/dockLayout'
import DocumentView from './informal/DocumentView.vue'
import GraphicalView from './informal/GraphicalView.vue'
import HybridGenerateDialog from './HybridGenerateDialog.vue'
import SegmentedSwitch from '../ui/SegmentedSwitch.vue'
import WorkspacePanel from './WorkspacePanel.vue'
import DockPanelChrome from './dock/DockPanelChrome.vue'
import DockDropHighlight from './dock/DockDropHighlight.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { nestedNodes, useInformalSpec } from '../../composables/useInformalSpec'
import { duplicateTitle, nextIndexedTitle } from '../../lib/informalTitles'
import type { InformalPatchPayload, InformalSpecPayload } from '../../../preload/index'

type SectionType = 'functions' | 'data-resources' | 'constraints'

defineProps<{
  title: string
  dirty?: boolean
  dragPanel: DockPanelId | null
  hoverTarget: DockPanelId | null
  hoverZone: DockZone | null
}>()

defineEmits<{ dragStart: [e: PointerEvent] }>()

const { t } = useI18n()
const workspace = useWorkspaceStore()
const tabId = computed(() => workspace.informalTab?.id)
const { spec, addNode, applyPatch, selectNode, revealNode } = useInformalSpec(tabId)
const documentRef = ref<InstanceType<typeof DocumentView> | null>(null)
const showGenerate = ref(false)

const viewOptions = computed(() => [
  { id: 'document', label: t('informal.documentView') },
  { id: 'graphical', label: t('informal.graphicalView') }
])

function findNode(id: string): InformalSpecPayload['sections'][0]['children'][0] | null {
  if (!spec.value) return null
  const walk = (nodes: InformalSpecPayload['sections'][0]['children']) => {
    for (const node of nodes) {
      if (node.id === id) return node
      const found = walk(nestedNodes(node))
      if (found) return found
    }
    return null
  }
  for (const section of spec.value.sections) {
    const found = walk(section.children)
    if (found) return found
  }
  return null
}

function sectionTypeOf(id: string): SectionType | null {
  if (!spec.value) return null
  for (const section of spec.value.sections) {
    const walk = (nodes: InformalSpecPayload['sections'][0]['children']): boolean => {
      for (const node of nodes) {
        if (node.id === id) return true
        if (walk(nestedNodes(node))) return true
      }
      return false
    }
    if (walk(section.children)) return section.type
  }
  return null
}

function onSelect(id: string): void {
  selectNode(id)
  if (workspace.informalViewMode !== 'document') return
  const span = revealNode(id)
  if (span) documentRef.value?.revealSpan(span)
}

async function onMove(id: string, parentId: string, afterId?: string): Promise<void> {
  const section = spec.value?.sections.find((s) => s.id === parentId || s.type === parentId)
  await applyPatch({
    operations: [{ op: 'move', id, parentId: section?.type ?? parentId, afterId }]
  })
}

function onAdd(section: SectionType): void {
  const titles = spec.value?.sections.find((s) => s.type === section)?.children.map((c) => c.title) ?? []
  const prefix =
    section === 'functions'
      ? t('informal.numberedFunction')
      : section === 'data-resources'
        ? t('informal.numberedData')
        : t('informal.numberedConstraint')
  const title = nextIndexedTitle(titles, prefix)
  const description =
    section === 'functions'
      ? t('informal.defaultBodyFunction')
      : section === 'data-resources'
        ? t('informal.defaultBodyData')
        : t('informal.defaultBodyConstraint')
  void addNode(section, title, description)
}

async function onRename(id: string, title: string): Promise<void> {
  await applyPatch({ operations: [{ op: 'update', id, title }] })
}

async function onRemove(id: string): Promise<void> {
  await applyPatch({ operations: [{ op: 'remove', id }] })
  if (workspace.informalSelectedNodeId === id) selectNode(null)
}

async function onDuplicate(id: string): Promise<void> {
  const node = findNode(id)
  const section = sectionTypeOf(id)
  if (!node || !section) return
  await applyPatch({
    operations: [
      {
        op: 'add',
        target: section,
        afterId: id,
        node: {
          type: node.type,
          title: duplicateTitle(node.title, t('informal.copySuffix')),
          description: node.description
        }
      }
    ]
  })
}

async function onUpdateBody(id: string, description: string): Promise<void> {
  await applyPatch({ operations: [{ op: 'update', id, description }] })
}

function onViewMode(id: string): void {
  workspace.informalViewMode = id === 'graphical' ? 'graphical' : 'document'
}
</script>

<template>
  <WorkspacePanel panel="informal" class="relative flex h-full min-h-0 flex-col" data-dock-host="informal">
    <DockDropHighlight :active="dragPanel !== null && hoverTarget === 'informal'" :zone="hoverZone" />
    <DockPanelChrome
      panel="informal"
      :title="title"
      :dirty="dirty"
      :dragging="dragPanel !== null && hoverTarget === 'informal'"
      :drop-zone="hoverTarget === 'informal' ? hoverZone : null"
      @drag-start="(_p, e) => $emit('dragStart', e)"
    >
      <template #actions>
        <div data-dock-no-drag class="flex min-w-0 items-center gap-2">
          <SegmentedSwitch
            :model-value="workspace.informalViewMode"
            :options="viewOptions"
            @update:model-value="onViewMode"
          />
          <button
            type="button"
            class="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-fg shadow-sm hover:opacity-90"
            @click="showGenerate = true"
          >
            {{ t('informal.generateHybrid') }}
          </button>
        </div>
      </template>
    </DockPanelChrome>
    <div class="min-h-0 flex-1">
      <DocumentView
        v-show="workspace.informalViewMode === 'document'"
        ref="documentRef"
        :tab-id="tabId"
        @add="onAdd"
      />
      <GraphicalView
        v-show="workspace.informalViewMode === 'graphical'"
        :spec="spec"
        @select="onSelect"
        @move="onMove"
        @add="onAdd"
        @rename="onRename"
        @remove="onRemove"
        @duplicate="onDuplicate"
        @update-body="onUpdateBody"
      />
    </div>
    <HybridGenerateDialog v-if="showGenerate" :source="workspace.informalTab?.content ?? ''" @close="showGenerate = false" />
  </WorkspacePanel>
</template>
