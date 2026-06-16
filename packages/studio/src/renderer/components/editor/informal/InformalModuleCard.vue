<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InformalModulePayload } from '../../../../preload/index'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'

const props = defineProps<{
  module: InformalModulePayload
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [idPath: string, value: unknown]
  addType: []
  addVariable: []
  addInvariant: []
  addConstant: []
  removeType: [id: string]
  removeVariable: [id: string]
  removeInvariant: [id: string]
  removeConstant: [id: string]
}>()

const { t } = useI18n()
const desc = ref('')

watch(
  () => props.module.description,
  (v) => {
    desc.value = v ?? ''
  },
  { immediate: true }
)

watch(desc, (v) => {
  if (v !== props.module.description) {
    emit('patch', `module.${props.module.id}.description`, v)
  }
})
</script>

<template>
  <SectionCard :title="module.name">
    <FormField :label="t('informal.moduleDescription')">
      <TextField v-model="desc" :rows="3" :disabled="disabled" />
    </FormField>

    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-xs font-medium text-content-secondary">{{ t('informal.constants') }}</p>
        <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addConstant')">
          {{ t('informal.addEntry') }}
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="c in module.constants ?? []" :key="c.id" class="flex items-start gap-2 rounded border border-border-subtle p-2">
          <div class="min-w-0 flex-1 space-y-1">
            <TextField
              :model-value="c.name"
              :disabled="disabled"
              @update:model-value="(v) => emit('patch', `const.${c.id}.name`, v)"
            />
            <TextField
              :model-value="c.valueHint ?? ''"
              :disabled="disabled"
              :placeholder="t('informal.valueHint')"
              @update:model-value="(v) => emit('patch', `const.${c.id}.valueHint`, v)"
            />
          </div>
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="emit('removeConstant', c.id)">×</button>
        </li>
      </ul>
    </div>

    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-xs font-medium text-content-secondary">{{ t('informal.types') }}</p>
        <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addType')">
          {{ t('informal.addEntry') }}
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="ty in module.types ?? []" :key="ty.id" class="flex items-start gap-2 rounded border border-border-subtle p-2">
          <div class="min-w-0 flex-1 space-y-1">
            <TextField
              :model-value="ty.name"
              :disabled="disabled"
              @update:model-value="(v) => emit('patch', `type.${ty.id}.name`, v)"
            />
            <TextField
              :model-value="ty.typeHint ?? ''"
              :disabled="disabled"
              :placeholder="t('informal.typeHint')"
              @update:model-value="(v) => emit('patch', `type.${ty.id}.typeHint`, v)"
            />
          </div>
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="emit('removeType', ty.id)">×</button>
        </li>
      </ul>
    </div>

    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-xs font-medium text-content-secondary">{{ t('informal.variables') }}</p>
        <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addVariable')">
          {{ t('informal.addEntry') }}
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="v in module.variables ?? []" :key="v.id" class="flex items-start gap-2 rounded border border-border-subtle p-2">
          <div class="min-w-0 flex-1 space-y-1">
            <TextField :model-value="v.name" :disabled="disabled" @update:model-value="(val) => emit('patch', `var.${v.id}.name`, val)" />
            <TextField
              :model-value="v.typeHint ?? ''"
              :disabled="disabled"
              :placeholder="t('informal.typeHint')"
              @update:model-value="(val) => emit('patch', `var.${v.id}.typeHint`, val)"
            />
          </div>
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="emit('removeVariable', v.id)">×</button>
        </li>
      </ul>
    </div>

    <div class="mt-4">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-xs font-medium text-content-secondary">{{ t('informal.invariants') }}</p>
        <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addInvariant')">
          {{ t('informal.addEntry') }}
        </button>
      </div>
      <ul class="space-y-2">
        <li v-for="inv in module.invariants ?? []" :key="inv.id" class="flex items-start gap-2 rounded border border-border-subtle p-2">
          <TextField
            class="flex-1"
            :model-value="inv.textHint ?? inv.description ?? ''"
            :rows="2"
            :disabled="disabled"
            @update:model-value="(val) => emit('patch', `inv.${inv.id}.textHint`, val)"
          />
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="emit('removeInvariant', inv.id)">×</button>
        </li>
      </ul>
    </div>
  </SectionCard>
</template>
