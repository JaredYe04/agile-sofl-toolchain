<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { GUI_MODEL_KEY } from '../../../composables/guiModelContext'
import { INFORMAL_MODEL_KEY } from '../../../composables/informalModelContext'
import type { InformalProcessOption } from '../../../preload/index'
import GuiToolbar from './GuiToolbar.vue'
import GuiScreenTree from './GuiScreenTree.vue'
import GuiScreenCard from './GuiScreenCard.vue'
import GuiWireframePreview from './GuiWireframePreview.vue'
import ResizableSplit from '../../ui/ResizableSplit.vue'

const props = defineProps<{ embedded?: boolean }>()

const { t } = useI18n()
const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiVisualEditor requires GUI_MODEL_KEY')

const informal = inject(INFORMAL_MODEL_KEY, null)

const selectedScreenId = ref<string | null>(null)

const screens = computed(() => gui.model.value?.screens ?? [])

watch(screens, (list) => {
  if (!list.length) {
    selectedScreenId.value = null
    return
  }
  if (!selectedScreenId.value || !list.some((s) => s.id === selectedScreenId.value)) {
    selectedScreenId.value = list[0]!.id
  }
}, { immediate: true })

const selectedScreen = computed(() => screens.value.find((s) => s.id === selectedScreenId.value) ?? null)

const processOptions = computed((): InformalProcessOption[] => {
  const modules = informal?.model.value?.modules ?? []
  const out: InformalProcessOption[] = []
  for (const mod of modules) {
    for (const p of mod.processes ?? []) {
      out.push({ id: p.id, name: p.name, moduleId: mod.id })
    }
  }
  return out
})

const writeDisabled = computed(() => gui.hasErrors.value)

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

async function onAddScreen(): Promise<void> {
  const id = newId('scr')
  await gui.addScreen({ id, name: `${id}Page`, title: t('gui.newScreen'), widgets: [] })
  selectedScreenId.value = id
}

async function onAddWidget(): Promise<void> {
  const sid = selectedScreenId.value
  if (!sid) return
  await gui.addWidget(sid, { id: newId('w'), kind: 'label', label: t('gui.newWidget') })
}

async function onPatch(idPath: string, value: unknown): Promise<void> {
  await gui.patchById(idPath, value)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col visual-panel">
    <GuiToolbar
      :disabled="writeDisabled"
      @add-screen="onAddScreen"
      @add-widget="onAddWidget"
      @format-yaml="gui.formatYaml()"
    />
    <ResizableSplit class="min-h-0 flex-1" :show-left="true" :show-right="true" :initial-left-percent="22">
      <template #left>
        <GuiScreenTree
          :screens="screens"
          :selected-id="selectedScreenId"
          :disabled="writeDisabled"
          @select="selectedScreenId = $event"
        />
      </template>
      <template #right>
        <ResizableSplit class="h-full" :show-left="true" :show-right="true" :initial-left-percent="50">
          <template #left>
            <div class="h-full overflow-y-auto studio-scroll p-4">
              <GuiScreenCard
                :screen="selectedScreen"
                :process-options="processOptions"
                :disabled="writeDisabled"
                @patch="onPatch"
                @add-widget="onAddWidget"
                @remove-widget="(id) => gui.removeWidget(id)"
              />
              <p v-if="!selectedScreen && screens.length" class="text-sm text-content-muted">{{ t('gui.selectScreen') }}</p>
              <p v-else-if="!screens.length" class="text-sm text-content-muted">{{ t('gui.noScreens') }}</p>
            </div>
          </template>
          <template #right>
            <GuiWireframePreview :screen="selectedScreen" />
          </template>
        </ResizableSplit>
      </template>
    </ResizableSplit>
    <p v-if="embedded && informal?.model.value?.meta.guiTarget" class="border-t border-border-subtle px-3 py-1 text-xs text-content-muted">
      {{ t('gui.linkedFile', { path: informal.model.value.meta.guiTarget }) }}
    </p>
  </div>
</template>
