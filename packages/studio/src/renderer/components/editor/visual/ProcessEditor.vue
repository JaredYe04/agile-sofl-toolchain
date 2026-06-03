<script setup lang="ts">
import { ref, watch } from 'vue'
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

const emit = defineEmits<{ patch: [payload: Omit<PatchDocumentPayload, 'source'>] }>()
const { t } = useI18n()

const decomText = ref('')
const commentText = ref('')

watch(
  () => [props.initialDecom, props.initialComment] as const,
  ([decom, comment]) => {
    decomText.value = decom ?? ''
    commentText.value = comment ?? ''
  },
  { immediate: true }
)

function applyDecom(): void {
  emit('patch', { kind: 'decom', processName: props.processName, text: decomText.value })
}

function applyComment(): void {
  emit('patch', { kind: 'comment', processName: props.processName, text: commentText.value })
}

function onFsfPatch(scenarios: FsfModelDto['scenarios'], others?: string): void {
  emit('patch', { kind: 'fsf', processName: props.processName, scenarios, others })
}
</script>

<template>
  <div class="space-y-6 p-4">
    <header>
      <h2 class="text-lg font-semibold text-content-primary">{{ t('visual.process') }} {{ processName }}</h2>
    </header>

    <section>
      <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-content-muted">
        {{ t('visual.decom') }}
      </label>
      <input
        v-model="decomText"
        type="text"
        class="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm"
        :placeholder="t('visual.decomPlaceholder')"
        @blur="applyDecom"
      />
    </section>

    <section>
      <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-content-muted">
        {{ t('visual.comment') }}
      </label>
      <textarea
        v-model="commentText"
        rows="2"
        class="w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm"
        :placeholder="t('visual.commentPlaceholder')"
        @blur="applyComment"
      />
    </section>

    <FsfScenarioEditor v-if="fsfModel" :model="fsfModel" @save="onFsfPatch" />
    <p v-else class="text-sm text-content-muted">{{ t('visual.noFsf') }}</p>
  </div>
</template>
