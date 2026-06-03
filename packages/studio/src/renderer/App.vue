<script setup lang="ts">
import { onMounted } from 'vue'
import EditorLayout from './layouts/EditorLayout.vue'
import { useAppStore } from './stores/app'
import { useDocumentStore } from './stores/document'
import { useLspStore } from './stores/lsp'
import { initLocaleFromSystem } from './i18n'

const app = useAppStore()
const doc = useDocumentStore()
const lsp = useLspStore()

onMounted(async () => {
  await initLocaleFromSystem()
  await app.init()
  doc.initHome()
  lsp.init()
})
</script>

<template>
  <EditorLayout />
</template>
