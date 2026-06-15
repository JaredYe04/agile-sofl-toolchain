<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SymbolHint } from './predicate/predicateTypes'
import PredicateBuilder from './predicate/PredicateBuilder.vue'
import SectionCard from './ui/SectionCard.vue'
import IconButton from './ui/IconButton.vue'
import EmptyState from './ui/EmptyState.vue'

export type FsfScenarioDto = {
  id: string
  test: string
  def: string
  span: { start: number; end: number; line: number; column: number }
}

export type FsfModelDto = {
  processName: string
  functionName?: string
  moduleName?: string
  span: FsfScenarioDto['span']
  scenarios: FsfScenarioDto[]
  others?: string
  othersSpan?: FsfScenarioDto['span']
}

const props = defineProps<{
  model: FsfModelDto
  symbols?: SymbolHint[]
  disabled?: boolean
  blockInformal?: boolean
}>()

const emit = defineEmits<{ save: [scenarios: FsfScenarioDto[], others?: string] }>()
const { t } = useI18n()

const scenarios = ref<FsfScenarioDto[]>([])
const others = ref('')
const snapshot = ref('')
const dragIndex = ref<number | null>(null)
const scenarioErrors = ref<Record<string, { test?: string | null; def?: string | null }>>({})

watch(
  () => props.model,
  (m) => {
    scenarios.value = m.scenarios.map((s) => ({ ...s }))
    others.value = m.others ?? ''
    snapshot.value = serialize()
    scenarioErrors.value = {}
  },
  { immediate: true, deep: true }
)

function serialize(): string {
  return JSON.stringify({ scenarios: scenarios.value, others: others.value })
}

function hasValidationErrors(): boolean {
  if (othersError.value) return true
  for (const s of scenarios.value) {
    const e = scenarioErrors.value[s.id]
    if (e?.test || e?.def) return true
  }
  return false
}

function hasInformalText(text: string): boolean {
  return /\binformal\b/i.test(text.trim())
}

function validateStrictInformal(): boolean {
  if (!props.blockInformal) return true
  let ok = true
  for (const s of scenarios.value) {
    if (hasInformalText(s.test)) {
      setScenarioError(s.id, 'test', t('visual.fsfStrictBlocked'))
      ok = false
    } else {
      setScenarioError(s.id, 'test', null)
    }
    if (hasInformalText(s.def)) {
      setScenarioError(s.id, 'def', t('visual.fsfStrictBlocked'))
      ok = false
    } else {
      setScenarioError(s.id, 'def', null)
    }
  }
  if (hasInformalText(others.value)) {
    othersError.value = t('visual.fsfStrictBlocked')
    ok = false
  } else {
    othersError.value = null
  }
  return ok
}

function trySave(): void {
  if (props.disabled || serialize() === snapshot.value || hasValidationErrors()) return
  if (!validateStrictInformal()) return
  emit('save', scenarios.value, others.value || undefined)
  snapshot.value = serialize()
}

watch(scenarios, trySave, { deep: true })
watch(others, trySave)

function addScenario(): void {
  scenarios.value.push({
    id: `${props.model.processName || props.model.functionName}-scenario-${scenarios.value.length + 1}`,
    test: '',
    def: '',
    span: scenarios.value[0]?.span ?? { start: 0, end: 0, line: 1, column: 1 }
  })
}

function removeScenario(index: number): void {
  scenarios.value.splice(index, 1)
}

function onDragStart(index: number, e: DragEvent): void {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(index: number): void {
  const from = dragIndex.value
  dragIndex.value = null
  if (from === null || from === index) return
  const list = [...scenarios.value]
  const [item] = list.splice(from, 1)
  list.splice(index, 0, item!)
  scenarios.value = list
}

function onDragEnd(): void {
  dragIndex.value = null
}

function setScenarioError(id: string, field: 'test' | 'def', error: string | null): void {
  const cur = scenarioErrors.value[id] ?? {}
  scenarioErrors.value = { ...scenarioErrors.value, [id]: { ...cur, [field]: error } }
}

function scenarioError(id: string): string | null {
  const e = scenarioErrors.value[id]
  if (!e) return null
  if (e.test) return e.test
  if (e.def) return e.def
  return null
}

const othersError = ref<string | null>(null)

defineExpose({ addScenario })
</script>

<template>
  <SectionCard :title="t('visual.fsfTitle')">
    <div v-if="!scenarios.length" class="mb-3">
      <EmptyState :message="t('visual.noScenarios')">
        <template #action>
          <button
            type="button"
            class="text-sm text-accent hover:underline disabled:opacity-40"
            :disabled="disabled"
            @click="addScenario"
          >
            {{ t('visual.addScenario') }}
          </button>
        </template>
      </EmptyState>
    </div>

    <div class="space-y-3">
      <div
        v-for="(scenario, index) in scenarios"
        :key="scenario.id"
        class="rounded-md border border-border-subtle bg-surface-base p-3 transition-opacity"
        :class="dragIndex === index ? 'opacity-60' : ''"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <div class="mb-3 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="cursor-grab text-content-muted" :title="t('visual.scenarioDrag')">⋮⋮</span>
            <span class="text-sm font-medium text-content-secondary">{{ t('visual.scenario') }} {{ index + 1 }}</span>
          </div>
          <IconButton variant="danger" :disabled="disabled" @click="removeScenario(index)">
            {{ t('visual.remove') }}
          </IconButton>
        </div>
        <p v-if="scenarioError(scenario.id)" class="mb-2 text-xs text-semantic-error">
          {{ t('visual.scenarioParseError') }}: {{ scenarioError(scenario.id) }}
        </p>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="border-l-2 border-accent/40 pl-3">
            <PredicateBuilder
              v-model="scenario.test"
              :symbols="symbols"
              :disabled="disabled"
              :block-informal="blockInformal"
              :label="t('visual.fsfTest')"
              @parse-error="(e) => setScenarioError(scenario.id, 'test', e)"
            />
          </div>
          <div class="border-l-2 border-role-process/50 pl-3">
            <PredicateBuilder
              v-model="scenario.def"
              :symbols="symbols"
              :disabled="disabled"
              :block-informal="blockInformal"
              :label="t('visual.fsfDef')"
              @parse-error="(e) => setScenarioError(scenario.id, 'def', e)"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="text-sm text-accent hover:underline disabled:opacity-40"
        :disabled="disabled"
        @click="addScenario"
      >
        {{ t('visual.addScenario') }}
      </button>

      <div class="border-t border-border-subtle pt-3">
        <PredicateBuilder
          v-model="others"
          :symbols="symbols"
          :disabled="disabled"
          :block-informal="blockInformal"
          :label="t('visual.fsfOthers')"
          @parse-error="(e) => (othersError = e)"
        />
        <p v-if="othersError" class="mt-1 text-xs text-semantic-error">{{ othersError }}</p>
      </div>
    </div>
  </SectionCard>
</template>
