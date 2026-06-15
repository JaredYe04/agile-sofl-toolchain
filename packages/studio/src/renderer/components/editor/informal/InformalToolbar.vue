<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ disabled?: boolean; showRemoveProcess?: boolean }>()
const emit = defineEmits<{
  addProcess: []
  addFunction: []
  removeProcess: []
  formatYaml: []
}>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap gap-2 border-b border-border-subtle px-2 py-1.5">
    <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addProcess')">
      {{ t('informal.addProcess') }}
    </button>
    <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addFunction')">
      {{ t('informal.addFunction') }}
    </button>
    <button
      v-if="showRemoveProcess"
      type="button"
      class="text-xs text-semantic-error hover:underline disabled:opacity-40"
      :disabled="disabled"
      @click="emit('removeProcess')"
    >
      {{ t('informal.removeProcess') }}
    </button>
    <button type="button" class="ml-auto text-xs text-content-secondary hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('formatYaml')">
      {{ t('informal.formatYaml') }}
    </button>
  </div>
</template>
