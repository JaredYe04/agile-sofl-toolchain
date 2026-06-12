<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualInvariantItem } from '../../../preload/index'
import SectionCard from './ui/SectionCard.vue'
import TextField from './ui/TextField.vue'

const props = defineProps<{
  invariants: VisualInvariantItem[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  revealSpan: [span: VisualInvariantItem['span']]
  patch: [payload: { span: VisualInvariantItem['span']; text: string }]
}>()

const { t } = useI18n()
const drafts = ref<string[]>([])

watch(
  () => props.invariants,
  (items) => {
    drafts.value = items.map((inv) => inv.text)
  },
  { immediate: true, deep: true }
)

watch(
  drafts,
  (next) => {
    if (props.disabled) return
    for (let i = 0; i < next.length; i++) {
      const inv = props.invariants[i]
      if (inv && (next[i] ?? '') !== inv.text) {
        emit('patch', { span: inv.span, text: next[i] ?? '' })
      }
    }
  },
  { deep: true }
)
</script>

<template>
  <SectionCard v-if="invariants.length" :title="t('visual.section.inv')">
    <div class="space-y-2">
      <div
        v-for="(inv, i) in invariants"
        :key="i"
        class="rounded-md border border-border-subtle bg-surface-base p-3"
      >
        <button
          type="button"
          class="mb-2 text-xs text-accent hover:underline"
          @click="emit('revealSpan', inv.span)"
        >
          {{ t('visual.context.revealInCode') }}
        </button>
        <TextField v-model="drafts[i]" :rows="2" mono :disabled="disabled" />
      </div>
    </div>
  </SectionCard>
</template>
