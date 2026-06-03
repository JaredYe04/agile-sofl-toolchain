<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import { useRecentFilesStore } from '../../stores/recentFiles'
import { useFileActions } from '../../composables/useFileActions'
import { useNewFileDialog } from '../../composables/useNewFileDialog'

const { t } = useI18n()
const doc = useDocumentStore()
const recent = useRecentFilesStore()
const files = useFileActions()
const newFileDialog = useNewFileDialog()

function onNew(): void {
  newFileDialog.show()
}

async function onOpen(): Promise<void> {
  await files.openFile()
}

async function openRecent(path: string): Promise<void> {
  const result = await window.studio!.fileRead(path)
  doc.openFromFile(result.filePath, result.content, result.title)
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center overflow-auto bg-surface-base px-8 py-12">
    <div class="w-full max-w-lg rounded-xl border border-border-subtle bg-surface-raised p-8 shadow-sm">
      <div class="mb-6 flex items-center gap-4">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15 text-2xl font-bold text-accent"
        >
          A
        </div>
        <div>
          <h1 class="text-xl font-semibold text-content-primary">{{ t('home.title') }}</h1>
          <p class="mt-1 text-sm text-content-secondary">{{ t('home.subtitle') }}</p>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          type="button"
          class="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent/90 active:scale-[0.98]"
          @click="onNew"
        >
          {{ t('home.newFile') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-border-subtle px-4 py-2 text-sm text-content-primary transition-colors duration-150 hover:bg-surface-overlay active:scale-[0.98]"
          @click="onOpen"
        >
          {{ t('home.openFile') }}
        </button>
      </div>

      <div class="mt-8">
        <h2 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
          {{ t('home.recentFiles') }}
        </h2>
        <ul v-if="recent.items.length" class="space-y-1">
          <li v-for="item in recent.items" :key="item.path">
            <button
              type="button"
              class="w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-content-primary"
              :title="item.path"
              @click="openRecent(item.path)"
            >
              {{ item.title }}
            </button>
          </li>
        </ul>
        <p v-else class="text-sm text-content-muted">{{ t('home.noRecent') }}</p>
      </div>
    </div>
  </div>
</template>
