<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export type FsfScenarioDto = {
  id: string
  test: string
  def: string
  span: { start: number; end: number; line: number; column: number }
}

export type FsfModelDto = {
  processName: string
  span: FsfScenarioDto['span']
  scenarios: FsfScenarioDto[]
  others?: string
  othersSpan?: FsfScenarioDto['span']
}

const props = defineProps<{ model: FsfModelDto }>()
const emit = defineEmits<{ save: [scenarios: FsfScenarioDto[], others?: string] }>()
const { t } = useI18n()

const scenarios = ref<FsfScenarioDto[]>([])
const others = ref('')

watch(
  () => props.model,
  (m) => {
    scenarios.value = m.scenarios.map((s) => ({ ...s }))
    others.value = m.others ?? ''
  },
  { immediate: true, deep: true }
)

function addScenario(): void {
  scenarios.value.push({
    id: `${props.model.processName}-scenario-${scenarios.value.length + 1}`,
    test: '',
    def: '',
    span: scenarios.value[0]?.span ?? { start: 0, end: 0, line: 1, column: 1 }
  })
}

function removeScenario(index: number): void {
  scenarios.value.splice(index, 1)
}

function save(): void {
  emit('save', scenarios.value, others.value || undefined)
}

defineExpose({ save, addScenario })
</script>

<template>
  <section class="rounded-lg border border-border-subtle bg-surface-base p-4">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-medium text-content-primary">{{ t('visual.fsfTitle') }}</h3>
      <button
        type="button"
        class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        @click="save"
      >
        {{ t('visual.fsfSave') }}
      </button>
    </div>

    <div class="space-y-3">
      <div
        v-for="(scenario, index) in scenarios"
        :key="scenario.id"
        class="rounded-md border border-border-subtle bg-surface-raised p-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-content-secondary">{{ t('visual.scenario') }} {{ index + 1 }}</span>
          <button
            type="button"
            class="text-sm text-content-secondary hover:text-danger"
            @click="removeScenario(index)"
          >
            {{ t('visual.remove') }}
          </button>
        </div>
        <label class="mb-1 block text-sm text-content-secondary">{{ t('visual.fsfTest') }}</label>
        <input
          v-model="scenario.test"
          type="text"
          class="mb-2 w-full rounded border border-border-subtle bg-surface-base px-3 py-2 font-mono text-sm text-content-primary"
        />
        <label class="mb-1 block text-sm text-content-secondary">{{ t('visual.fsfDef') }}</label>
        <input
          v-model="scenario.def"
          type="text"
          class="w-full rounded border border-border-subtle bg-surface-base px-3 py-2 font-mono text-sm text-content-primary"
        />
      </div>

      <button
        type="button"
        class="text-sm text-accent hover:underline"
        @click="addScenario"
      >
        {{ t('visual.addScenario') }}
      </button>

      <div>
        <label class="mb-1 block text-sm text-content-secondary">{{ t('visual.fsfOthers') }}</label>
        <input
          v-model="others"
          type="text"
          class="w-full rounded border border-border-subtle bg-surface-base px-3 py-2 font-mono text-sm text-content-primary"
        />
      </div>
    </div>
  </section>
</template>
