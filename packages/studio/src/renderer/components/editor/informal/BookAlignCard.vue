<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookAlignPayload } from '../../../../preload/index'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

const props = defineProps<{ bookAlign?: BookAlignPayload; disabled?: boolean }>()
const emit = defineEmits<{ patch: [bookAlign: BookAlignPayload] }>()
const { t } = useI18n()

const local = ref<BookAlignPayload>({ functions: [], data: [], constraints: [] })

watch(
  () => props.bookAlign,
  (b) => {
    local.value = {
      functions: b?.functions?.map((x) => ({ ...x })) ?? [],
      data: b?.data?.map((x) => ({ ...x, usedBy: x.usedBy ? [...x.usedBy] : [] })) ?? [],
      constraints: b?.constraints?.map((x) => ({ ...x, refs: x.refs ? [...x.refs] : [] })) ?? []
    }
  },
  { immediate: true, deep: true }
)

function emitPatch(): void {
  emit('patch', JSON.parse(JSON.stringify(local.value)) as BookAlignPayload)
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}`
}

function addFunction(): void {
  local.value.functions = [...(local.value.functions ?? []), { ref: newId('F'), description: '' }]
  emitPatch()
}
function addData(): void {
  local.value.data = [...(local.value.data ?? []), { ref: newId('D'), description: '', usedBy: [] }]
  emitPatch()
}
function addConstraint(): void {
  local.value.constraints = [...(local.value.constraints ?? []), { ref: newId('C'), description: '', refs: [] }]
  emitPatch()
}

function updateFn(i: number, field: 'ref' | 'description', v: string): void {
  const list = local.value.functions ?? []
  list[i] = { ...list[i]!, [field]: v }
  local.value.functions = [...list]
  emitPatch()
}
function updateData(i: number, field: 'ref' | 'description' | 'usedBy', v: string): void {
  const list = local.value.data ?? []
  const cur = { ...list[i]! }
  if (field === 'usedBy') cur.usedBy = v.split(/[,;\s]+/).filter(Boolean)
  else cur[field] = v
  list[i] = cur
  local.value.data = [...list]
  emitPatch()
}
function updateConstraint(i: number, field: 'ref' | 'description' | 'refs', v: string): void {
  const list = local.value.constraints ?? []
  const cur = { ...list[i]! }
  if (field === 'refs') cur.refs = v.split(/[,;\s]+/).filter(Boolean)
  else cur[field] = v
  list[i] = cur
  local.value.constraints = [...list]
  emitPatch()
}
</script>

<template>
  <SectionCard :title="t('informal.bookAlign')">
    <div class="space-y-4">
      <div>
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-medium text-content-secondary">{{ t('informal.bookFunctions') }}</p>
          <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="addFunction">
            {{ t('informal.addEntry') }}
          </button>
        </div>
        <div v-for="(fn, i) in local.functions ?? []" :key="i" class="mb-2 grid gap-2 rounded border border-border-subtle p-2 md:grid-cols-2">
          <TextField :model-value="fn.ref" :disabled="disabled" @update:model-value="(v) => updateFn(i, 'ref', v)" />
          <TextField :model-value="fn.description" :rows="2" :disabled="disabled" @update:model-value="(v) => updateFn(i, 'description', v)" />
        </div>
      </div>
      <div>
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-medium text-content-secondary">{{ t('informal.bookData') }}</p>
          <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="addData">
            {{ t('informal.addEntry') }}
          </button>
        </div>
        <div v-for="(d, i) in local.data ?? []" :key="i" class="mb-2 space-y-2 rounded border border-border-subtle p-2">
          <div class="grid gap-2 md:grid-cols-2">
            <TextField :model-value="d.ref" :disabled="disabled" @update:model-value="(v) => updateData(i, 'ref', v)" />
            <TextField :model-value="d.description" :rows="2" :disabled="disabled" @update:model-value="(v) => updateData(i, 'description', v)" />
          </div>
          <FormField :label="t('informal.usedBy')">
            <TextField :model-value="(d.usedBy ?? []).join(', ')" :disabled="disabled" @update:model-value="(v) => updateData(i, 'usedBy', v)" />
          </FormField>
        </div>
      </div>
      <div>
        <div class="mb-2 flex items-center justify-between">
          <p class="text-xs font-medium text-content-secondary">{{ t('informal.bookConstraints') }}</p>
          <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="addConstraint">
            {{ t('informal.addEntry') }}
          </button>
        </div>
        <div v-for="(c, i) in local.constraints ?? []" :key="i" class="mb-2 space-y-2 rounded border border-border-subtle p-2">
          <div class="grid gap-2 md:grid-cols-2">
            <TextField :model-value="c.ref" :disabled="disabled" @update:model-value="(v) => updateConstraint(i, 'ref', v)" />
            <TextField :model-value="c.description" :rows="2" :disabled="disabled" @update:model-value="(v) => updateConstraint(i, 'description', v)" />
          </div>
          <FormField :label="t('informal.constraintRefs')">
            <TextField :model-value="(c.refs ?? []).join(', ')" :disabled="disabled" @update:model-value="(v) => updateConstraint(i, 'refs', v)" />
          </FormField>
        </div>
      </div>
    </div>
  </SectionCard>
</template>
