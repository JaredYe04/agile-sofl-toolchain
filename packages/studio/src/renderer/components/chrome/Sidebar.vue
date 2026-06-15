<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../../stores/projectStore'
import { useDocumentStore } from '../../stores/document'
import type { ProjectScanPayload } from '../../preload/index'

const { t } = useI18n()
const project = useProjectStore()
const doc = useDocumentStore()

const scan = ref<ProjectScanPayload | null>(null)
const loading = ref(false)
const showUnpaired = ref(false)

async function refresh(): Promise<void> {
  if (!project.root || !window.studio?.scanProject) {
    scan.value = null
    return
  }
  loading.value = true
  project.setScanning(true)
  try {
    scan.value = await window.studio.scanProject(project.root)
  } finally {
    loading.value = false
    project.setScanning(false)
  }
}

watch(() => project.root, () => void refresh(), { immediate: true })
onMounted(() => void refresh())

const pairs = computed(() => scan.value?.pairs ?? [])
const unpairedAsfl = computed(() => {
  if (!scan.value) return []
  const paired = new Set(pairs.value.map((p) => p.asflPath).filter(Boolean))
  return scan.value.asflFiles.filter((f) => !paired.has(f))
})

const busy = computed(() => project.opening || loading.value)

async function onOpenFolder(): Promise<void> {
  if (busy.value) return
  await project.openFolder()
}

async function openFile(path: string): Promise<void> {
  const result = await window.studio!.fileRead(path)
  doc.openFromFile(result.filePath, result.content, result.title)
}

async function openPair(pair: ProjectScanPayload['pairs'][0]): Promise<void> {
  await openFile(pair.aspecPath)
  if (pair.asflPath) await openFile(pair.asflPath)
}

function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path
}
</script>

<template>
  <aside class="flex h-full w-56 shrink-0 flex-col border-r border-border-subtle bg-surface-raised">
    <div class="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
      <span class="text-xs font-medium uppercase tracking-wide text-content-secondary">{{ t('sidebar.project') }}</span>
      <button
        type="button"
        class="shrink-0 rounded-md border border-border-subtle px-2 py-1 text-xs font-medium text-content-primary transition-colors duration-150 hover:bg-surface-overlay active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="busy"
        @click="onOpenFolder"
      >
        {{ busy ? t('sidebar.loading') : t('sidebar.openFolder') }}
      </button>
    </div>
    <div class="studio-scroll flex-1 overflow-y-auto p-2">
      <p v-if="!project.root" class="px-1 text-xs text-content-muted">{{ t('sidebar.noProject') }}</p>
      <p v-else-if="loading" class="px-1 text-xs text-content-muted">{{ t('sidebar.scanning') }}</p>
      <template v-else>
        <p class="px-1 pb-1 text-xs font-medium text-content-secondary">{{ t('sidebar.pairs') }}</p>
        <ul class="space-y-1">
          <li v-for="pair in pairs" :key="pair.aspecPath">
            <button
              type="button"
              class="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs hover:bg-surface-overlay"
              :title="pair.aspecPath"
              @click="openPair(pair)"
            >
              <span class="truncate text-content-primary">{{ basename(pair.aspecPath) }}</span>
              <span
                class="shrink-0 rounded px-1 text-[10px]"
                :class="pair.asflPath ? 'bg-semantic-success/20 text-semantic-success' : 'bg-semantic-warning/20 text-semantic-warning'"
              >
                {{ pair.asflPath ? t('sidebar.paired') : t('sidebar.unpaired') }}
              </span>
            </button>
          </li>
        </ul>
        <button
          v-if="unpairedAsfl.length"
          type="button"
          class="mt-3 rounded-md border border-border-subtle px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-overlay"
          @click="showUnpaired = !showUnpaired"
        >
          {{ t('sidebar.unpairedAsfl', { count: unpairedAsfl.length }) }}
        </button>
        <ul v-if="showUnpaired" class="mt-1 space-y-0.5">
          <li v-for="file in unpairedAsfl" :key="file">
            <button
              type="button"
              class="w-full truncate rounded px-2 py-1 text-left text-xs text-content-primary hover:bg-surface-overlay"
              @click="openFile(file)"
            >
              {{ basename(file) }}
            </button>
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>
