<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'

const { t } = useI18n()
const doc = useDocumentStore()
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center bg-surface-base px-8">
    <div class="max-w-md text-center">
      <h2 class="text-lg font-semibold text-content-primary">{{ t('welcome.title') }}</h2>
      <p class="mt-3 text-sm text-content-secondary">{{ t('welcome.message') }}</p>
      <button
        type="button"
        class="mt-6 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent/90 active:scale-[0.98]"
        @click="doc.goHome()"
      >
        {{ t('welcome.goHome') }}
      </button>
    </div>
  </div>
</template>
