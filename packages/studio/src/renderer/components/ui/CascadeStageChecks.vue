<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Checkbox from './Checkbox.vue'

export type CascadeStageValue = {
  hybridSpec: boolean
  modules: boolean
  processes: boolean
  scenarios: boolean
  typesVars?: boolean
  invariants?: boolean
  gui?: boolean
}

export type CascadeStageLabels = {
  hybridSpec: string
  modules: string
  processes: string
  scenarios: string
  typesVars: string
  invariants: string
  gui: string
  more: string
}

const props = withDefaults(
  defineProps<{
    modelValue: CascadeStageValue
    labels?: Partial<CascadeStageLabels>
  }>(),
  { labels: () => ({}) }
)

const emit = defineEmits<{ 'update:modelValue': [value: CascadeStageValue] }>()

const moreOpen = ref(false)

const resolvedLabels = computed<CascadeStageLabels>(() => ({
  hybridSpec: props.labels.hybridSpec ?? 'Generate Hybrid Spec',
  modules: props.labels.modules ?? 'Modules',
  processes: props.labels.processes ?? 'Processes',
  scenarios: props.labels.scenarios ?? 'Scenarios',
  typesVars: props.labels.typesVars ?? 'Types & Variables',
  invariants: props.labels.invariants ?? 'Invariants',
  gui: props.labels.gui ?? 'GUI',
  more: props.labels.more ?? 'More stages'
}))

const forcedOn = computed(() => props.modelValue.hybridSpec)

const modulesChecked = computed(() => forcedOn.value || props.modelValue.modules)
const processesChecked = computed(() => forcedOn.value || props.modelValue.processes)
const scenariosChecked = computed(() => forcedOn.value || props.modelValue.scenarios)

function extraChecked(key: 'typesVars' | 'invariants' | 'gui'): boolean {
  const value = props.modelValue[key]
  if (value !== undefined) return value
  if (key === 'gui') return true
  return props.modelValue.hybridSpec
}

function emitValue(next: CascadeStageValue): void {
  emit('update:modelValue', next)
}

function withHybridDefaults(value: CascadeStageValue): CascadeStageValue {
  return {
    ...value,
    hybridSpec: true,
    modules: true,
    processes: true,
    scenarios: true,
    typesVars: value.typesVars ?? true,
    invariants: value.invariants ?? true,
    gui: value.gui ?? true
  }
}

function setHybridSpec(on: boolean): void {
  if (on) {
    emitValue(withHybridDefaults(props.modelValue))
    return
  }
  emitValue({ ...props.modelValue, hybridSpec: false })
}

function setForcedStage(key: 'modules' | 'processes' | 'scenarios', on: boolean): void {
  if (props.modelValue.hybridSpec) return
  emitValue({ ...props.modelValue, [key]: on })
}

function setExtra(key: 'typesVars' | 'invariants' | 'gui', on: boolean): void {
  emitValue({ ...props.modelValue, [key]: on })
}

watch(
  () => props.modelValue.hybridSpec,
  (on) => {
    if (!on) return
    const current = props.modelValue
    if (current.modules && current.processes && current.scenarios) return
    emitValue(withHybridDefaults(current))
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-1.5 text-[12px]">
    <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
      <Checkbox
        :model-value="modelValue.hybridSpec"
        :label="resolvedLabels.hybridSpec"
        @update:model-value="setHybridSpec"
      />
    </div>

    <div class="ml-5 space-y-1.5">
      <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
        <Checkbox
          :model-value="modulesChecked"
          :disabled="forcedOn"
          :label="resolvedLabels.modules"
          @update:model-value="setForcedStage('modules', $event)"
        />
      </div>
      <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
        <Checkbox
          :model-value="processesChecked"
          :disabled="forcedOn"
          :label="resolvedLabels.processes"
          @update:model-value="setForcedStage('processes', $event)"
        />
      </div>
      <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
        <Checkbox
          :model-value="scenariosChecked"
          :disabled="forcedOn"
          :label="resolvedLabels.scenarios"
          @update:model-value="setForcedStage('scenarios', $event)"
        />
      </div>
      <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
        <Checkbox
          :model-value="extraChecked('gui')"
          :label="resolvedLabels.gui"
          @update:model-value="setExtra('gui', $event)"
        />
      </div>

      <button
        type="button"
        class="flex items-center gap-1 rounded-md px-1 py-1 text-[12px] text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
        @click="moreOpen = !moreOpen"
      >
        <span class="select-none text-[11px] text-content-muted">{{ moreOpen ? '▾' : '▸' }}</span>
        <span>{{ resolvedLabels.more }}</span>
      </button>

      <div v-if="moreOpen" class="space-y-1.5">
        <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
          <Checkbox
            :model-value="extraChecked('typesVars')"
            :label="resolvedLabels.typesVars"
            @update:model-value="setExtra('typesVars', $event)"
          />
        </div>
        <div class="rounded-md border border-border-subtle bg-surface-raised px-2.5 py-2">
          <Checkbox
            :model-value="extraChecked('invariants')"
            :label="resolvedLabels.invariants"
            @update:model-value="setExtra('invariants', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
