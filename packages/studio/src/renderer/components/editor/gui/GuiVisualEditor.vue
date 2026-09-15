<script setup lang="ts">
import { ref, computed, inject, watch } from 'vue'
import { GUI_MODEL_KEY } from '../../../composables/guiModelContext'
import { INFORMAL_MODEL_KEY } from '../../../composables/informalModelContext'
import GuiDesignerCanvas from './GuiDesignerCanvas.vue'

defineProps<{ embedded?: boolean }>()

const gui = inject(GUI_MODEL_KEY)
if (!gui) throw new Error('GuiVisualEditor requires GUI_MODEL_KEY')
inject(INFORMAL_MODEL_KEY, null)

const selectedScreenId = ref<string | null>(null)
const screens = computed(() => gui.model.value?.screens ?? [])

watch(
  screens,
  (list) => {
    if (!list.length) {
      selectedScreenId.value = null
      return
    }
    if (!selectedScreenId.value || !list.some((s) => s.id === selectedScreenId.value)) {
      selectedScreenId.value = list[0]!.id
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="visual-panel flex h-full min-h-0 w-full min-w-0 flex-col">
    <GuiDesignerCanvas
      class="min-h-0 flex-1"
      :selected-view-id="selectedScreenId"
      @update:selected-view-id="selectedScreenId = $event"
    />
  </div>
</template>
