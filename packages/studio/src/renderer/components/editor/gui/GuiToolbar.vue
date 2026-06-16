<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ disabled?: boolean; previewMode?: boolean }>()
const emit = defineEmits<{ addScreen: []; addWidget: []; formatYaml: []; togglePreview: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
    <button
      type="button"
      class="text-xs hover:underline disabled:opacity-40"
      :class="previewMode ? 'text-content-primary font-medium' : 'text-accent'"
      @click="emit('togglePreview')"
    >
      {{ previewMode ? t('gui.editMode') : t('gui.previewMode') }}
    </button>
    <template v-if="!previewMode">
      <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addScreen')">
        {{ t('gui.addScreen') }}
      </button>
      <button type="button" class="text-xs text-accent hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('addWidget')">
        {{ t('gui.addWidget') }}
      </button>
      <button type="button" class="ml-auto text-xs text-content-secondary hover:underline disabled:opacity-40" :disabled="disabled" @click="emit('formatYaml')">
        {{ t('gui.formatYaml') }}
      </button>
    </template>
  </div>
</template>
