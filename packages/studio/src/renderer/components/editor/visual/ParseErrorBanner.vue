<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ message?: string }>()
const { t } = useI18n()
</script>

<template>
  <div
    class="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300"
    role="alert"
  >
    {{ message ?? t('visual.parseError') }}
  </div>
</template>
