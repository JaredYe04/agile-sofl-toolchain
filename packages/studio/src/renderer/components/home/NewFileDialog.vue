<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../../stores/document'
import {
  useNewFileDialog,
  groupTemplates,
  inferDocumentKind,
  isBlankTemplate,
  type TemplateEntry
} from '../../composables/useNewFileDialog'
import NewFileBlankCard from './NewFileBlankCard.vue'
import NewFileTemplateCard from './NewFileTemplateCard.vue'

const { t } = useI18n()
const doc = useDocumentStore()
const { open, loadManifest, loadTemplateContent, hide } = useNewFileDialog()

const templates = ref<TemplateEntry[]>([])
const loading = ref(false)

const grouped = computed(() => groupTemplates(templates.value))

async function refreshManifest(): Promise<void> {
  loading.value = true
  try {
    templates.value = await loadManifest()
  } catch (err) {
    console.error('[studio] failed to load templates:', err)
  } finally {
    loading.value = false
  }
}

watch(open, (visible) => {
  if (visible && templates.value.length === 0) void refreshManifest()
})

function onKeydown(e: KeyboardEvent): void {
  if (!open.value) return
  if (e.key === 'Escape') hide()
}

onMounted(() => {
  void refreshManifest()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown))

async function pick(entry: TemplateEntry): Promise<void> {
  try {
    const content = await loadTemplateContent(entry.file)
    const documentKind = inferDocumentKind(entry.file)
    const title = isBlankTemplate(entry)
      ? undefined
      : entry.file.replace(/\.(asfl|aspec|guispec)$/, '')
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
        class="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-raised shadow-lg"
        role="dialog"
        aria-modal="true"
        :aria-label="t('newFile.title')"
        @click.stop
      >
        <div class="flex items-center gap-4 border-b border-border-subtle px-6 py-5">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-xl font-bold text-accent"
            aria-hidden="true"
          >
            +
          </div>
          <div>
            <h2 class="text-lg font-semibold text-content-primary">{{ t('newFile.title') }}</h2>
            <p class="mt-0.5 text-sm text-content-secondary">{{ t('newFile.subtitle') }}</p>
          </div>
        </div>

        <div class="studio-scroll flex-1 overflow-y-auto px-6 py-5">
          <div v-if="loading" class="grid gap-3 sm:grid-cols-3">
            <div
              v-for="n in 3"
              :key="n"
              class="h-24 animate-pulse rounded-lg border border-dashed border-border-subtle bg-surface-overlay"
            />
          </div>

          <div v-else class="space-y-6">
            <section v-if="grouped.blanks.length">
              <div class="mb-3">
                <h3 class="text-sm font-semibold text-content-primary">{{ t('newFile.section.blank') }}</h3>
                <p class="mt-0.5 text-xs text-content-muted">{{ t('newFile.section.blankHint') }}</p>
              </div>
              <div class="grid gap-3 sm:grid-cols-3">
                <NewFileBlankCard
                  v-for="entry in grouped.blanks"
                  :key="entry.id"
                  :entry="entry"
                  @pick="pick"
                />
              </div>
            </section>

            <section v-if="grouped.asfl.length">
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">
                {{ t('newFile.section.asfl') }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <NewFileTemplateCard
                  v-for="entry in grouped.asfl"
                  :key="entry.id"
                  :entry="entry"
                  @pick="pick"
                />
              </div>
            </section>

            <section v-if="grouped.informal.length">
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">
                {{ t('newFile.section.informal') }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <NewFileTemplateCard
                  v-for="entry in grouped.informal"
                  :key="entry.id"
                  :entry="entry"
                  @pick="pick"
                />
              </div>
            </section>

            <section v-if="grouped.gui.length">
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">
                {{ t('newFile.section.gui') }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <NewFileTemplateCard
                  v-for="entry in grouped.gui"
                  :key="entry.id"
                  :entry="entry"
                  @pick="pick"
                />
              </div>
            </section>
          </div>
        </div>

        <div class="flex justify-end border-t border-border-subtle px-6 py-3">
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
