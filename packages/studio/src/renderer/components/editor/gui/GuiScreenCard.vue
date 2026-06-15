<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GuiScreenDto, InformalProcessOption } from '../../../preload/index'
import SectionCard from '../visual/ui/SectionCard.vue'
import FormField from '../visual/ui/FormField.vue'
import TextField from '../visual/ui/TextField.vue'
import GuiWidgetList from './GuiWidgetList.vue'

const props = defineProps<{
  screen: GuiScreenDto | null
  processOptions: InformalProcessOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [idPath: string, value: unknown]
  addWidget: []
  removeWidget: [id: string]
}>()

const { t } = useI18n()
const title = ref('')
const description = ref('')
const triggersProcess = ref('')

watch(
  () => props.screen,
  (s) => {
    title.value = s?.title ?? ''
    description.value = s?.description ?? ''
    triggersProcess.value = s?.triggersProcess ?? ''
  },
  { immediate: true }
)

function commitField(field: string, value: string): void {
  if (!props.screen) return
  emit('patch', `screen.${props.screen.id}.${field}`, value)
}
</script>

<template>
  <SectionCard v-if="screen" :title="t('gui.screenDetails')">
    <FormField :label="t('gui.screenTitle')">
      <TextField v-model="title" :disabled="disabled" @blur="commitField('title', title)" />
    </FormField>
    <FormField :label="t('gui.description')" class="mt-3">
      <TextField v-model="description" :rows="3" :disabled="disabled" @blur="commitField('description', description)" />
    </FormField>
    <FormField :label="t('gui.triggersProcess')" class="mt-3">
      <select
        v-model="triggersProcess"
        class="w-full rounded-md border border-field-border bg-field-bg px-2 py-1.5 text-sm"
        :disabled="disabled"
        @change="commitField('triggersProcess', triggersProcess)"
      >
        <option value="">{{ t('gui.none') }}</option>
        <option v-for="p in processOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </FormField>
    <div class="mt-4">
      <GuiWidgetList
        :widgets="screen.widgets ?? []"
        :disabled="disabled"
        @patch="(idPath, v) => emit('patch', idPath, v)"
        @add="emit('addWidget')"
        @remove="(id) => emit('removeWidget', id)"
      />
    </div>
  </SectionCard>
</template>
