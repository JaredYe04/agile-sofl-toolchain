<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisualModuleProcess } from '../../../preload/index'
import SectionCard from './ui/SectionCard.vue'
import FormField from './ui/FormField.vue'
import TextField from './ui/TextField.vue'
import Badge from './ui/Badge.vue'
import InlineRename from './ui/InlineRename.vue'

const props = defineProps<{
  process: VisualModuleProcess
  disabled?: boolean
  writeDisabledReason?: 'parseFailed' | 'diagnostics' | null
}>()

const emit = defineEmits<{
  patchAlias: [target: string]
  rename: [name: string]
}>()

const { t } = useI18n()
const aliasTarget = ref('')
const renaming = ref(false)

watch(
  () => props.process.aliasTarget,
  (target) => {
    aliasTarget.value = target ?? ''
  },
  { immediate: true }
)

watch(aliasTarget, (text) => {
  if (props.disabled) return
  if (text === (props.process.aliasTarget ?? '')) return
  emit('patchAlias', text)
})

const disabledMessage = () => {
  if (props.writeDisabledReason === 'parseFailed') return t('visual.writeDisabledParseFailed')
  if (props.writeDisabledReason === 'diagnostics') return t('visual.writeDisabledDiagnostics')
  return t('visual.writeDisabled')
}
</script>

<template>
  <div class="visual-panel space-y-4 p-4">
    <header class="flex items-center gap-2">
      <h2 class="flex min-w-0 items-center gap-2 text-lg font-semibold text-content-primary">
        <span class="shrink-0">{{ t('visual.process') }}</span>
        <InlineRename
          :model-value="process.name"
          :editing="renaming"
          :disabled="disabled"
          @update:editing="renaming = $event"
          @commit="emit('rename', $event)"
        />
      </h2>
      <Badge variant="process">{{ t('visual.alias.badge') }}</Badge>
    </header>

    <div
      v-if="disabled"
      class="rounded-md border border-semantic-warning/40 bg-semantic-warning/10 px-3 py-2 text-sm text-semantic-warning"
    >
      {{ disabledMessage() }}
    </div>

    <SectionCard :title="t('visual.alias.title')">
      <p class="mb-3 text-sm text-content-secondary">{{ t('visual.alias.description') }}</p>
      <FormField :label="t('visual.alias.target')">
        <TextField
          v-model="aliasTarget"
          mono
          :disabled="disabled"
          :placeholder="t('visual.alias.targetPlaceholder')"
        />
      </FormField>
    </SectionCard>
  </div>
</template>
