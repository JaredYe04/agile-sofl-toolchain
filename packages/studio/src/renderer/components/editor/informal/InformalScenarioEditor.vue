<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InformalScenarioPayload } from '../../../../preload/index'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

const props = defineProps<{
  scenarios: InformalScenarioPayload[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateScenario: [id: string, field: 'condition' | 'outcome', value: string]
  addScenario: []
  removeScenario: [id: string]
}>()

const { t } = useI18n()
const drafts = ref<Record<string, { condition: string; outcome: string }>>({})

watch(
  () => props.scenarios,
  (list) => {
    const next: Record<string, { condition: string; outcome: string }> = {}
    for (const s of list) {
      next[s.id] = { condition: s.condition, outcome: s.outcome }
    }
    drafts.value = next
  },
  { immediate: true, deep: true }
)

function onField(id: string, field: 'condition' | 'outcome', value: string): void {
  const orig = props.scenarios.find((s) => s.id === id)
  if (!orig || orig[field] === value) return
  emit('updateScenario', id, field, value)
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-xs font-medium text-content-secondary">{{ t('informal.scenarios') }}</p>
      <button
        type="button"
        class="text-xs text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="emit('addScenario')"
      >
        {{ t('informal.addScenario') }}
      </button>
    </div>
    <ul v-if="scenarios.length" class="space-y-3">
      <li v-for="sc in scenarios" :key="sc.id" class="rounded border border-border-subtle p-2">
        <FormField :label="t('informal.condition')">
          <TextField
            :model-value="drafts[sc.id]?.condition ?? sc.condition"
            :rows="2"
            :disabled="disabled"
            @update:model-value="(v) => onField(sc.id, 'condition', v)"
          />
        </FormField>
        <FormField :label="t('informal.outcome')" class="mt-2">
          <TextField
            :model-value="drafts[sc.id]?.outcome ?? sc.outcome"
            :rows="2"
            :disabled="disabled"
            @update:model-value="(v) => onField(sc.id, 'outcome', v)"
          />
        </FormField>
        <button
          type="button"
          class="mt-2 text-xs text-semantic-error hover:underline disabled:opacity-40"
          :disabled="disabled"
          @click="emit('removeScenario', sc.id)"
        >
          {{ t('informal.removeScenario') }}
        </button>
      </li>
    </ul>
    <p v-else class="text-xs text-content-muted">{{ t('informal.noScenarios') }}</p>
  </div>
</template>
