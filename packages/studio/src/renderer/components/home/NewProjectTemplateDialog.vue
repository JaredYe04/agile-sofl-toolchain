<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  useNewProjectTemplateDialog,
  groupProjectTemplates,
  type ProjectTemplateEntry
} from '../../composables/useNewProjectTemplateDialog'
import { useWorkspaceStore } from '../../stores/workspace'
import { useModalStore } from '../../stores/modal'
import NewProjectTemplateCard from './NewProjectTemplateCard.vue'

const { t } = useI18n()
const { open, loadManifest, hide } = useNewProjectTemplateDialog()
const workspace = useWorkspaceStore()
const modal = useModalStore()

const templates = ref<ProjectTemplateEntry[]>([])
const loading = ref(false)

const grouped = computed(() => groupProjectTemplates(templates.value))

async function refreshManifest(): Promise<void> {
  loading.value = true
  try {
    templates.value = await loadManifest()
  } catch (err) {
    console.error('[studio] failed to load project templates:', err)
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

async function pick(entry: ProjectTemplateEntry): Promise<void> {
  const defaultName = entry.id === 'blank' ? 'NewSystem' : entry.id.replace(/-/g, ' ')
  const { index, value } = await modal.show({
    title: t('newProjectTemplate.nameTitle'),
    message: t('newProjectTemplate.nameMessage'),
    buttons: [t('workspace.create'), t('newProjectTemplate.cancel')],
    input: true,
    inputValue: defaultName,
    inputPlaceholder: t('workspace.projectName')
  })
  if (index !== 0 || !value?.trim()) return
  hide()
  await workspace.createProjectFromTemplate(value.trim(), entry.id)
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
        :aria-label="t('newProjectTemplate.title')"
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
            <h2 class="text-lg font-semibold text-content-primary">{{ t('newProjectTemplate.title') }}</h2>
            <p class="mt-0.5 text-sm text-content-secondary">{{ t('newProjectTemplate.subtitle') }}</p>
          </div>
        </div>

        <div class="studio-scroll flex-1 overflow-y-auto px-6 py-5">
          <div v-if="loading" class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="n in 4"
              :key="n"
              class="h-24 animate-pulse rounded-lg border border-dashed border-border-subtle bg-surface-overlay"
            />
          </div>

          <div v-else class="space-y-6">
            <section v-if="grouped.basic.length">
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">
                {{ t('newProjectTemplate.section.basic') }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <NewProjectTemplateCard
                  v-for="entry in grouped.basic"
                  :key="entry.id"
                  :entry="entry"
                  @pick="pick"
                />
              </div>
            </section>

            <section v-if="grouped.example.length">
              <h3 class="mb-3 text-xs font-medium uppercase tracking-wide text-content-muted">
                {{ t('newProjectTemplate.section.example') }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <NewProjectTemplateCard
                  v-for="entry in grouped.example"
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
            {{ t('newProjectTemplate.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
