<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TreeSelection } from '../../../composables/useVisualModel'
import { actionsForSelection, type VisualActionType } from '../../../composables/visualActions'
import type { DeclarationKind } from '../../../preload/index'

const props = defineProps<{
  x: number
  y: number
  selection: TreeSelection
  parseFailed: boolean
  hasDiagnostics: boolean
}>()

const emit = defineEmits<{
  action: [type: VisualActionType, declarationKind?: DeclarationKind]
  close: []
}>()

const { t } = useI18n()

const items = computed(() =>
  actionsForSelection(props.selection, {
    parseFailed: props.parseFailed,
    hasDiagnostics: props.hasDiagnostics
  })
)

function label(type: VisualActionType): string {
  return t(`visual.context.${type}`)
}

function onPick(type: VisualActionType): void {
  if (type === 'addDeclaration') {
    emit('action', type, 'const')
  } else {
    emit('action', type)
  }
  emit('close')
}
</script>

<template>
  <div
    class="fixed z-50 min-w-[160px] rounded-md border border-border-subtle bg-surface-raised py-1 shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <button
      v-for="type in items"
      :key="type"
      type="button"
      class="block w-full px-3 py-1.5 text-left text-sm text-content-primary hover:bg-surface-overlay"
      @click="onPick(type)"
    >
      {{ label(type) }}
    </button>
  </div>
</template>
