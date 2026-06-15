<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { GuiWidget, GuiWidgetKind } from '../../../preload/index'

const props = defineProps<{
  widgets: GuiWidget[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  patch: [idPath: string, value: unknown]
  add: []
  remove: [id: string]
}>()

const { t } = useI18n()

const kinds: GuiWidgetKind[] = [
  'label',
  'text-input',
  'button',
  'checkbox',
  'select',
  'list',
  'table',
  'section',
  'navigation'
]
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-xs font-medium text-content-secondary">{{ t('gui.widgets') }}</p>
      <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('add')">
        {{ t('gui.addWidget') }}
      </button>
    </div>
    <ul class="space-y-2">
      <li v-for="w in widgets" :key="w.id" class="rounded-md border border-border-subtle p-2">
        <div class="flex items-center gap-2">
          <select
            :value="w.kind"
            class="rounded border border-field-border bg-field-bg px-1 py-0.5 text-xs"
            :disabled="disabled"
            @change="emit('patch', `widget.${w.id}.kind`, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
          </select>
          <input
            :value="w.label ?? ''"
            class="min-w-0 flex-1 rounded border border-field-border bg-field-bg px-2 py-1 text-xs"
            :placeholder="t('gui.widgetLabel')"
            :disabled="disabled"
            @change="emit('patch', `widget.${w.id}.label`, ($event.target as HTMLInputElement).value)"
          />
          <button type="button" class="text-xs text-semantic-error hover:underline" :disabled="disabled" @click="emit('remove', w.id)">
            {{ t('gui.remove') }}
          </button>
        </div>
        <input
          v-if="w.kind === 'text-input' || w.kind === 'select'"
          :value="w.binds?.param ?? ''"
          class="mt-1 w-full rounded border border-field-border bg-field-bg px-2 py-1 text-xs font-mono"
          :placeholder="t('gui.bindParam')"
          :disabled="disabled"
          @change="
            emit('patch', `widget.${w.id}.binds`, {
              ...w.binds,
              param: ($event.target as HTMLInputElement).value
            })
          "
        />
      </li>
    </ul>
  </div>
</template>
