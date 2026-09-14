<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExtVarItem, PatchDocumentPayload, VisualModuleProcess } from '../../../preload/index'
import type { FsfModelDto } from './FsfScenarioEditor.vue'
import FsfScenarioEditor from './FsfScenarioEditor.vue'
import ExtBlockEditor from './ExtBlockEditor.vue'
import SignatureEditor from './SignatureEditor.vue'
import SectionCard from './ui/SectionCard.vue'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import Badge from './ui/Badge.vue'
import InlineRename from './ui/InlineRename.vue'
import { findMissingCases } from '../../../specAssist/findMissingCases'

const props = defineProps<{
  process: VisualModuleProcess
  processName: string
  moduleName: string
  initialDecom?: string
  initialComment?: string
  fsfModel: FsfModelDto | null
  disabled?: boolean
  blockInformal?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
  symbols?: import('./predicate/predicateTypes').SymbolHint[]
}>()

const emit = defineEmits<{
  patch: [payload: Omit<PatchDocumentPayload, 'source'>]
  patchExt: [vars: ExtVarItem[]]
  patchSignature: [signature: string]
  patchInit: [isInit: boolean]
  rename: [name: string]
}>()

const isInitDraft = ref(false)

watch(
  () => props.process.isInit,
  (init) => {
    isInitDraft.value = Boolean(init)
  },
  { immediate: true }
)

watch(isInitDraft, (init) => {
  if (props.disabled) return
  if (init === Boolean(props.process.isInit)) return
  emit('patchInit', init)
})

const { t } = useI18n()
const fsfRef = ref<InstanceType<typeof FsfScenarioEditor> | null>(null)
const renaming = ref(false)

defineExpose({
  addScenario() {
    fsfRef.value?.addScenario()
  }
})

function stripFieldPrefix(text: string, prefix: string): string {
  const trimmed = text.trim()
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim()
  }
  return trimmed
}

const decomText = ref('')
const commentText = ref('')
const preText = ref('')
const postText = ref('')

watch(
  () => [props.initialDecom, props.initialComment, props.process.pre, props.process.post] as const,
  ([decom, comment, pre, post]) => {
    decomText.value = stripFieldPrefix(decom ?? '', 'decom:')
    commentText.value = stripFieldPrefix(comment ?? '', 'comment:')
    preText.value = pre ?? ''
    postText.value = post ?? ''
  },
  { immediate: true }
)

watch(decomText, (text) => {
  if (props.disabled) return
  const original = stripFieldPrefix(props.initialDecom ?? '', 'decom:')
  if (text === original) return
  emit('patch', { kind: 'decom', processName: props.processName, text })
})

watch(commentText, (text) => {
  if (props.disabled) return
  const original = stripFieldPrefix(props.initialComment ?? '', 'comment:')
  if (text === original) return
  emit('patch', { kind: 'comment', processName: props.processName, text })
})

watch(preText, (text) => {
  if (props.disabled) return
  if (text === (props.process.pre ?? '')) return
  emit('patch', { kind: 'pre', processName: props.processName, text })
})

watch(postText, (text) => {
  if (props.disabled) return
  if (text === (props.process.post ?? '')) return
  emit('patch', { kind: 'post', processName: props.processName, text })
})

function onFsfPatch(scenarios: FsfModelDto['scenarios'], others?: string): void {
  emit('patch', { kind: 'fsf', processName: props.processName, scenarios, others })
}

const disabledMessage = () => {
  if (props.writeDisabledReason === 'parseFailed') return t('visual.writeDisabledParseFailed')
  if (props.writeDisabledReason === 'diagnostics') return t('visual.writeDisabledDiagnostics')
  return t('visual.writeDisabled')
}

const traceBadges = computed(() => {
  const comment = commentText.value
  const ids = [...comment.matchAll(/aspec_([a-z0-9_]+)/gi)].map((m) => m[1]!.replace(/_/g, '-'))
  return ids
})

const missingCases = computed(() =>
  findMissingCases({
    name: props.processName,
    pre: preText.value,
    post: postText.value,
    comment: commentText.value,
    scenarioCount: props.process.scenarioCount
  })
)

function addMissingCase(summary: string): void {
  const addition = `else ${summary}`
  if (postText.value.toLowerCase().includes(summary.toLowerCase())) return
  postText.value = postText.value.trim() ? `${postText.value.trim()} ${addition}` : addition
}

</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header class="flex flex-wrap items-center gap-2">
      <h2 class="flex min-w-0 items-center gap-2 text-lg font-semibold text-content-primary">
        <span class="shrink-0">{{ t('visual.process') }}</span>
        <InlineRename
          v-if="!process.isInit"
          :model-value="processName"
          :editing="renaming"
          :disabled="disabled"
          @update:editing="renaming = $event"
          @commit="emit('rename', $event)"
        />
        <span v-else class="text-lg font-semibold">Init</span>
      </h2>
      <Badge variant="process">{{ t('visual.nodeRole.process') }}</Badge>
      <Badge v-if="process.isInit" variant="neutral">{{ t('visual.init.badge') }}</Badge>
      <Badge v-if="process.formalizationStatus === 'formal'" variant="formal">{{ t('visual.status.formal') }}</Badge>
      <Badge v-else-if="process.formalizationStatus === 'mixed'" variant="semi-formal">{{ t('visual.status.mixed') }}</Badge>
      <Badge v-else-if="process.formalizationStatus === 'semi-formal'" variant="semi-formal">{{ t('visual.status.semiFormal') }}</Badge>
      <Badge v-if="process.hasPre" variant="semi-formal">{{ t('visual.status.hasPre') }}</Badge>
      <Badge v-if="(process.scenarioCount ?? 0) > 0" variant="formal">FSF</Badge>
      <Badge v-if="process.fsfFormal === 'formal'" variant="formal">{{ t('visual.fsfFormal') }}</Badge>
      <Badge v-else-if="process.fsfFormal === 'semi-formal'" variant="semi-formal">{{ t('visual.fsfSemiFormal') }}</Badge>
    </header>
    <div v-if="traceBadges.length" class="flex flex-wrap gap-1">
      <button
        v-for="id in traceBadges"
        :key="id"
        type="button"
        class="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent"
      >
        {{ t('visual.traceFrom') }} {{ id }}
      </button>
    </div>

    <div
      v-if="disabled"
      class="rounded-md border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning"
    >
      {{ disabledMessage() }}
    </div>

    <SectionCard>
      <label class="mb-3 flex items-center gap-2 text-sm text-content-primary">
        <input v-model="isInitDraft" type="checkbox" class="rounded border-border-subtle" :disabled="disabled" />
        <span>{{ t('visual.init.label') }}</span>
      </label>
      <SignatureEditor
        :signature="process.signature ?? '()'"
        :inputs="process.inputs"
        :outputs="process.outputs"
        kind="process"
        :disabled="disabled"
        @patch="emit('patchSignature', $event)"
      />
    </SectionCard>

    <ExtBlockEditor
      :vars="process.ext ?? []"
      :disabled="disabled"
      @patch="emit('patchExt', $event)"
    />

    <SectionCard>
      <FormField :label="t('visual.pre')">
        <TextField
          v-model="preText"
          :rows="3"
          :disabled="disabled"
          :placeholder="t('visual.prePlaceholder')"
        />
      </FormField>
      <FormField :label="t('visual.post')" class="mt-4">
        <TextField
          v-model="postText"
          :rows="5"
          :disabled="disabled"
          :placeholder="t('visual.postPlaceholder')"
        />
      </FormField>
    </SectionCard>

    <SectionCard v-if="missingCases.length" :title="t('visual.missingCases')">
      <ul class="space-y-2">
        <li v-for="c in missingCases" :key="c.id" class="flex items-start justify-between gap-2 text-[12px] text-content-secondary">
          <span>⚠ {{ c.summary }}</span>
          <button
            type="button"
            class="shrink-0 text-accent hover:underline disabled:opacity-40"
            :disabled="disabled"
            @click="addMissingCase(c.summary)"
          >
            {{ t('visual.addToSpec') }}
          </button>
        </li>
      </ul>
    </SectionCard>

    <SectionCard>
      <FormField :label="t('visual.decom')">
        <TextField
          v-model="decomText"
          :disabled="disabled"
          :placeholder="t('visual.decomPlaceholder')"
        />
      </FormField>
      <FormField :label="t('visual.comment')" class="mt-4">
        <TextField
          v-model="commentText"
          :rows="3"
          :disabled="disabled"
          :placeholder="t('visual.commentPlaceholder')"
        />
      </FormField>
    </SectionCard>

    <FsfScenarioEditor
      v-if="fsfModel"
      ref="fsfRef"
      :model="fsfModel"
      :symbols="symbols"
      :disabled="disabled"
      :block-informal="blockInformal"
      @save="onFsfPatch"
    />
    <p v-else class="text-sm text-content-secondary">{{ t('visual.noFsfDerived') }}</p>
  </div>
</template>
