<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useNewFileDialog, type TemplateEntry } from '../../composables/useNewFileDialog'

const { t } = useI18n()
const doc = useDocumentStore()
const { open, loadManifest, loadTemplateContent, hide } = useNewFileDialog()

const templates = ref<TemplateEntry[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    templates.value = await loadManifest()
  } catch (err) {
    console.error('[studio] failed to load templates:', err)
  } finally {
    loading.value = false
  }
})

async function pick(entry: TemplateEntry): Promise<void> {
  try {
    const content = await loadTemplateContent(entry.file)
    const documentKind = entry.file.endsWith('.aspec') ? 'aspec' : 'asfl'
    const title =
      entry.id === 'blank' || entry.id === 'informal-blank'
        ? undefined
        : entry.file.replace(/\.(asfl|aspec)$/, '')
    doc.newTab({ content, title, documentKind })
    hide()
  } catch (err) {
    console.error('[studio] failed to open template:', err)
  }
}

function onBackdrop(e: MouseEvent): void {
  if (e.target === e.currentTarget) hide()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click="onBackdrop"
    >
      <div
        class="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-label="t('newFile.title')"
      >
        <div class="border-b border-border-subtle px-5 py-4">
          <h2 class="text-lg font-semibold text-content-primary">{{ t('newFile.title') }}</h2>
          <p class="mt-1 text-sm text-content-secondary">{{ t('newFile.subtitle') }}</p>
        </div>

        <div class="overflow-y-auto p-4">
          <p v-if="loading" class="text-sm text-content-muted">{{ t('newFile.loading') }}</p>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <button
              v-for="entry in templates"
              :key="entry.id"
              type="button"
              class="rounded-lg border border-border-subtle p-4 text-left transition-colors duration-150 hover:border-accent/40 hover:bg-surface-overlay active:scale-[0.99]"
              @click="pick(entry)"
            >
              <div class="font-medium text-content-primary">{{ t(entry.titleKey) }}</div>
              <div class="mt-1 text-xs text-content-secondary">{{ t(entry.descriptionKey) }}</div>
            </button>
          </div>
        </div>

        <div class="flex justify-end border-t border-border-subtle px-5 py-3">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-content-primary"
            @click="hide()"
          >
            {{ t('newFile.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
