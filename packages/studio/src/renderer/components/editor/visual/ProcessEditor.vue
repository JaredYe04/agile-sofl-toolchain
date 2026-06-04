<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PatchDocumentPayload } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import FsfScenarioEditor from './FsfScenarioEditor.vue'

const props = defineProps<{
  processName: string
  initialDecom?: string
  initialComment?: string
  fsfModel: FsfModelDto | null
}>()

const emit = defineEmits<{
  patch: [payload: Omit<PatchDocumentPayload, 'source'>]
  applyAll: []
}>()

defineExpose({
  applyAll() {
    applyDecom()
    applyComment()
    fsfRef.value?.save()
  },
  addScenario() {
    fsfRef.value?.addScenario()
  }
})

const { t } = useI18n()
const fsfRef = ref<InstanceType<typeof FsfScenarioEditor> | null>(null)

function stripFieldPrefix(text: string, prefix: string): string {
  const trimmed = text.trim()
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim()
  }
  return trimmed
}

const decomText = ref('')
const commentText = ref('')
const decomOriginal = ref('')
const commentOriginal = ref('')

watch(
  () => [props.initialDecom, props.initialComment] as const,
  ([decom, comment]) => {
    decomOriginal.value = stripFieldPrefix(decom ?? '', 'decom:')
    commentOriginal.value = stripFieldPrefix(comment ?? '', 'comment:')
    decomText.value = decomOriginal.value
    commentText.value = commentOriginal.value
  },
  { immediate: true }
)

const decomDirty = computed(() => decomText.value !== decomOriginal.value)
const commentDirty = computed(() => commentText.value !== commentOriginal.value)

function applyDecom(): void {
  if (!decomDirty.value) return
  emit('patch', { kind: 'decom', processName: props.processName, text: decomText.value })
  decomOriginal.value = decomText.value
}

function applyComment(): void {
  if (!commentDirty.value) return
  emit('patch', { kind: 'comment', processName: props.processName, text: commentText.value })
  commentOriginal.value = commentText.value
}

function onFsfPatch(scenarios: FsfModelDto['scenarios'], others?: string): void {
  emit('patch', { kind: 'fsf', processName: props.processName, scenarios, others })
}
</script>

<template>
  <div class="visual-panel space-y-6 p-4">
    <header>
      <h2 class="text-lg font-semibold text-content-primary">{{ t('visual.process') }} {{ processName }}</h2>
    </header>

    <section>
      <div class="mb-2 flex items-center justify-between">
        <label class="text-sm font-medium text-content-secondary">{{ t('visual.decom') }}</label>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
          :disabled="!decomDirty"
          @click="applyDecom"
        >
          {{ t('visual.apply') }}
        </button>
      </div>
      <input
        v-model="decomText"
        type="text"
        class="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content-primary"
        :placeholder="t('visual.decomPlaceholder')"
        @keydown.enter.prevent="applyDecom"
      />
      <span v-if="decomDirty" class="mt-1 block text-xs text-accent">{{ t('visual.unsaved') }}</span>
    </section>

    <section>
      <div class="mb-2 flex items-center justify-between">
        <label class="text-sm font-medium text-content-secondary">{{ t('visual.comment') }}</label>
        <button
          type="button"
          class="rounded px-2 py-0.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
          :disabled="!commentDirty"
          @click="applyComment"
        >
          {{ t('visual.apply') }}
        </button>
      </div>
      <textarea
        v-model="commentText"
        rows="3"
        class="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content-primary"
        :placeholder="t('visual.commentPlaceholder')"
        @keydown.ctrl.enter.prevent="applyComment"
        @keydown.meta.enter.prevent="applyComment"
      />
      <span v-if="commentDirty" class="mt-1 block text-xs text-accent">{{ t('visual.unsaved') }}</span>
    </section>

    <FsfScenarioEditor v-if="fsfModel" ref="fsfRef" :model="fsfModel" @save="onFsfPatch" />
    <p v-else class="text-sm text-content-secondary">{{ t('visual.noFsf') }}</p>
  </div>
</template>
