<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualModuleSummary } from '../../../preload/index'
import { useDocumentStore } from '../../../stores/document'
import { useVisualModel, type TreeSelection } from '../../../composables/useVisualModel'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import ParseErrorBanner from './ParseErrorBanner.vue'
import ModuleTree from './ModuleTree.vue'
import ModuleOverview from './ModuleOverview.vue'
import ProcessEditor from './ProcessEditor.vue'

const { t } = useI18n()
const doc = useDocumentStore()
const selected = ref<TreeSelection>(null)

const visual = useVisualModel(computed(() => doc.activeTabId))

const modules = computed(() => visual.model.value?.modules ?? [])

watch(modules, (list) => {
  if (!list.length) {
    selected.value = null
    return
  }
  if (!selected.value) {
    selected.value = { kind: 'module', moduleName: list[0].name }
  }
})

const selectedModule = computed(() =>
  selected.value ? modules.value.find((m) => m.name === selected.value!.moduleName) ?? null : null
)

const selectedFsfModel = computed(() => {
  if (selected.value?.kind !== 'process') return null
  const name = selected.value.processName
  return (visual.fsfModels.value as FsfModelDto[]).find((m) => m.processName === name) ?? null
})

const selectedProcess = computed(() => {
  if (selected.value?.kind !== 'process' || !selectedModule.value) return null
  return selectedModule.value.processes.find((p) => p.name === selected.value!.processName) ?? null
})

async function onPatch(payload: Parameters<NonNullable<typeof window.studio>['patchDocument']>[0]): Promise<void> {
  await visual.applySourcePatch(async (source) => {
    return window.studio!.patchDocument({ ...payload, source })
  })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-surface-base">
    <ParseErrorBanner v-if="visual.parseFailed.value && doc.activeTab?.content?.trim()" />
    <div class="flex min-h-0 flex-1">
      <ModuleTree :modules="modules" :selected="selected" @select="selected = $event" />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <ModuleOverview
          v-if="selected?.kind === 'module' && selectedModule"
          :module="selectedModule"
        />
        <ProcessEditor
          v-else-if="selected?.kind === 'process' && selectedProcess"
          :process-name="selected.processName"
          :initial-decom="selectedProcess.decom"
          :initial-comment="selectedProcess.comment"
          :fsf-model="selectedFsfModel"
          @patch="onPatch"
        />
        <div v-else class="flex h-full items-center justify-center p-8 text-sm text-content-muted">
          {{ t('visual.selectHint') }}
        </div>
      </div>
    </div>
  </div>
</template>
