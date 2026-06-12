import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TreeSelection } from '../composables/useVisualModel'

export const useEditorSelectionStore = defineStore('editorSelection', () => {
  const selection = ref<TreeSelection>(null)

  function setSelection(value: TreeSelection): void {
    selection.value = value
  }

  function clear(): void {
    selection.value = null
  }

  return { selection, setSelection, clear }
})
