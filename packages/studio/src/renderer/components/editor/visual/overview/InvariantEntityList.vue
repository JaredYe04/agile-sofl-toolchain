<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualInvariantItem } from '../../../../preload/index'
import EmptyState from '../ui/EmptyState.vue'
import FormField from '../ui/FormField.vue'
import TextField from '../ui/TextField.vue'
import VisualEditDialog from './VisualEditDialog.vue'
import VisualEntityMenu from './VisualEntityMenu.vue'
import { useModalStore } from '../../../../stores/modal'
import { isDuplicateInModule } from '../../../../lib/visualEntityGuard'
import type { VisualModuleSummary } from '../../../../preload/index'

const props = defineProps<{
  invariants: VisualInvariantItem[]
  module: VisualModuleSummary
  /** Syntax-only block (delete still allowed when only editDisabled) */
  disabled?: boolean
  editDisabled?: boolean
}>()

const emit = defineEmits<{
  patch: [payload: { index: number; text: string }]
  remove: [index: number]
  reorder: [fromIndex: number, toIndex: number]
}>()

const { t } = useI18n()
const modal = useModalStore()
const editingIndex = ref<number | null>(null)
const draftText = ref('')
const dragFrom = ref<number | null>(null)

function displayText(text: string): string {
  return text.replace(/^inv\b/i, '').replace(/;+\s*$/, '').trim()
}

function openEdit(index: number): void {
  editingIndex.value = index
  draftText.value = displayText(props.invariants[index]?.text ?? '')
}

async function confirmEdit(): Promise<void> {
  const i = editingIndex.value
  if (i == null) return
  const inv = props.invariants[i]
  if (!inv) return
  const text = draftText.value.trim() || 'true'
  if (
    isDuplicateInModule(props.module, 'invariant', text, { excludeInvariantIndex: i })
  ) {
    await modal.show({
      title: t('visual.duplicateName.title'),
      message: t('visual.duplicateName.message', { name: text }),
      buttons: [t('dialog.ok')]
    })
    return
  }
  emit('patch', { index: i, text })
  editingIndex.value = null
}

const formDisabled = computed(() => Boolean(props.disabled || props.editDisabled))

function onDragStart(index: number, e: DragEvent): void {
  if (formDisabled.value) return
  dragFrom.value = index
  e.dataTransfer?.setData('text/plain', String(index))
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
}

function onDrop(toIndex: number, e: DragEvent): void {
  e.preventDefault()
  const from = dragFrom.value ?? Number(e.dataTransfer?.getData('text/plain'))
  dragFrom.value = null
  if (!Number.isFinite(from) || from === toIndex) return
  emit('reorder', from, toIndex)
}

function onDragEnd(): void {
  dragFrom.value = null
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <h3 class="mb-2 text-sm font-semibold text-content-primary">{{ t('visual.section.inv') }}</h3>
    <EmptyState v-if="!invariants.length" :message="t('visual.inv.empty')" />
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="(inv, i) in invariants"
        :key="`${inv.span.start}-${i}`"
        class="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 transition-colors hover:border-accent/30"
        :class="dragFrom === i ? 'opacity-60' : ''"
        draggable="true"
        @dragstart="onDragStart(i, $event)"
        @dragover="onDragOver"
        @drop="onDrop(i, $event)"
        @dragend="onDragEnd"
      >
        <span class="mt-0.5 cursor-grab text-content-muted active:cursor-grabbing" :title="t('visual.inv.drag')">
          ⋮⋮
        </span>
        <p class="min-w-0 flex-1 font-mono text-[12px] leading-relaxed text-content-primary">
          {{ displayText(inv.text) }}
        </p>
        <VisualEntityMenu
          :disabled="disabled"
          :edit-disabled="formDisabled"
          @edit="openEdit(i)"
          @remove="emit('remove', i)"
        />
      </li>
    </ul>
  </div>

  <VisualEditDialog
    :open="editingIndex != null"
    :title="t('visual.inv.editTitle')"
    @close="editingIndex = null"
    @confirm="confirmEdit"
  >
    <FormField :label="t('visual.inv.predicate')">
      <TextField v-model="draftText" :rows="4" mono :disabled="formDisabled" />
    </FormField>
  </VisualEditDialog>
</template>
