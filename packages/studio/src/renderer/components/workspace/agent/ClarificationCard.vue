<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  question: string
  options?: Array<{ id: string; label: string }>
  allowCustom?: boolean
  multiSelect?: boolean
  disabled?: boolean
  pending?: boolean
  answer?: string
  expanded?: boolean
  prefillIds?: string[]
  prefillCustom?: string
}>()

const emit = defineEmits<{ submit: [value: string]; change: [optionId: string]; toggle: [] }>()
const selected = ref<string[]>([])
const custom = ref('')

const canSubmit = computed(
  () => selected.value.length > 0 || (props.allowCustom !== false && custom.value.trim())
)

function answerParts(): string[] {
  return (props.answer ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}

function isChosen(opt: { id: string; label: string }): boolean {
  if (props.pending) return selected.value.includes(opt.id)
  return answerParts().includes(opt.label)
}

function toggle(id: string): void {
  if (props.multiSelect) {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((x) => x !== id)
      : [...selected.value, id]
    return
  }
  selected.value = [id]
}

function submit(): void {
  const labels = (props.options ?? [])
    .filter((o) => selected.value.includes(o.id))
    .map((o) => o.label)
  const extra = custom.value.trim()
  const value = [...labels, extra].filter(Boolean).join('; ')
  if (!value) return
  emit('submit', value)
}

watch(
  () => (props.pending ? props.prefillIds : undefined),
  (ids) => {
    if (!props.pending || ids === undefined) return
    selected.value = [...ids]
    if (props.prefillCustom !== undefined) custom.value = props.prefillCustom
  },
  { immediate: true }
)

function onOptionClick(opt: { id: string; label: string }): void {
  if (props.disabled) return
  if (props.pending) {
    toggle(opt.id)
    return
  }
  emit('change', opt.id)
}
</script>

<template>
  <div class="agent-bubble mt-2 min-w-0 max-w-full overflow-hidden rounded-xl bg-surface-raised">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-overlay"
      @click="emit('toggle')"
    >
      <span class="studio-text-selectable min-w-0 flex-1 truncate text-[12px] font-medium text-content-primary">{{
        question
      }}</span>
      <span v-if="answer" class="studio-text-selectable max-w-[45%] truncate text-[11px] text-content-muted">{{
        answer
      }}</span>
      <span class="select-none text-[11px] text-content-muted">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <div v-if="expanded" class="min-w-0 border-t border-border-subtle px-3 pb-3 pt-2">
      <div v-if="options?.length" class="flex min-w-0 flex-col gap-1.5">
        <button
          v-for="opt in options"
          :key="opt.id"
          type="button"
          class="max-w-full min-w-0 truncate rounded-full border px-3 py-1 text-left text-[12px] transition-colors"
          :class="
            isChosen(opt)
              ? 'border-content-primary bg-content-primary/10 text-content-primary'
              : 'border-border-subtle text-content-secondary hover:border-content-primary/40 hover:text-content-primary'
          "
          :title="opt.label"
          :disabled="disabled"
          @click="onOptionClick(opt)"
        >
          {{ opt.label }}
        </button>
      </div>
      <div v-if="pending && allowCustom !== false" class="mt-2">
        <input
          v-model="custom"
          class="w-full rounded-md border border-field-border bg-field-bg px-2.5 py-1.5 text-[13px] text-content-primary outline-none focus:ring-2 focus:ring-accent/30"
          :placeholder="$t('agent.customAnswer')"
          :disabled="disabled"
          @keydown.enter.prevent="submit"
        />
      </div>
      <p
        v-if="!pending && answer"
        class="studio-text-selectable mt-2 min-w-0 truncate rounded-md bg-surface-base px-2.5 py-1.5 text-[12px] text-content-secondary"
        :title="answer"
      >
        {{ $t('agent.yourAnswer') }}：{{ answer }}
      </p>
      <button
        v-if="pending"
        type="button"
        class="mt-2 rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-accent-fg disabled:opacity-40"
        :disabled="disabled || !canSubmit"
        @click="submit"
      >
        {{ $t('agent.confirm') }}
      </button>
    </div>
  </div>
</template>
