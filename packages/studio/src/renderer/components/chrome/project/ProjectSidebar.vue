<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../../stores/projectStore'
import { useDocumentStore } from '../../../stores/document'
import { useEditorUiStore } from '../../../stores/editorUi'
import { useProjectScan, basename, type ProjectPair } from '../../../composables/useProjectScan'
import {
  useProjectContextMenu,
  type ProjectMenuAction
} from '../../../composables/useProjectContextMenu'
import ProjectPairCard from './ProjectPairCard.vue'
import ProjectFileRow from './ProjectFileRow.vue'
import ProjectContextMenu from './ProjectContextMenu.vue'
import DropdownMenu, { type MenuItem } from '../../ui/DropdownMenu.vue'

const { t } = useI18n()
const project = useProjectStore()
const doc = useDocumentStore()
const editorUi = useEditorUiStore()
const { root, opening } = storeToRefs(project)

const { pairs, unpaired, hasUnpaired, loading, refresh } = useProjectScan(root)
const {
  open: menuOpen,
  x: menuX,
  y: menuY,
  context: menuContext,
  show: showMenu,
  hide: hideMenu,
  buildItems
} = useProjectContextMenu()

const expandedPairs = ref<Set<string>>(new Set())
const showUnpaired = ref(false)

const busy = computed(() => opening.value || loading.value)
const folderName = computed(() => (project.root ? basename(project.root) : ''))
const activePath = computed(() => doc.activeTab?.filePath ?? null)

const menuItems = computed(() => buildItems(menuContext.value))

const headerMenuItems = computed<MenuItem[]>(() => [
  { id: 'open', label: t('sidebar.context.openFolder'), action: () => void onOpenFolder() },
  { id: 'refresh', label: t('sidebar.context.refresh'), action: () => void refresh() },
  { id: 'close', label: t('sidebar.context.closeProject'), action: () => project.closeProject() },
  { id: 'sep', label: '', separator: true },
  {
    id: 'collapse',
    label: t('sidebar.context.collapse'),
    action: () => editorUi.setShowProjectSidebar(false)
  }
])

function togglePair(aspecPath: string): void {
  const next = new Set(expandedPairs.value)
  if (next.has(aspecPath)) next.delete(aspecPath)
  else next.add(aspecPath)
  expandedPairs.value = next
}

async function openFile(path: string): Promise<void> {
  const result = await window.studio!.fileRead(path)
  doc.openFromFile(result.filePath, result.content, result.title)
}

async function openPair(
  pair: ProjectPair,
  mode: 'all' | 'aspec' | 'asfl' | 'guispec' = 'all'
): Promise<void> {
  if (mode === 'aspec' || mode === 'all') await openFile(pair.aspecPath)
  if ((mode === 'asfl' || mode === 'all') && pair.asflPath) await openFile(pair.asflPath)
  if ((mode === 'guispec' || mode === 'all') && pair.guispecPath) await openFile(pair.guispecPath)
}

async function onOpenFolder(): Promise<void> {
  if (busy.value) return
  await project.openFolder()
}

function onPanelContext(e: MouseEvent): void {
  showMenu(e.clientX, e.clientY, { kind: 'panel' })
}

function onPairContext(e: MouseEvent, pair: ProjectPair, path?: string): void {
  showMenu(e.clientX, e.clientY, { kind: 'pair', pair, path })
}

function onFileContext(e: MouseEvent, path: string): void {
  showMenu(e.clientX, e.clientY, { kind: 'file', path })
}

async function handleMenuAction(action: ProjectMenuAction): Promise<void> {
  const ctx = menuContext.value
  hideMenu()

  if (action === 'openFolder') {
    await onOpenFolder()
    return
  }
  if (action === 'refresh') {
    await refresh()
    return
  }
  if (action === 'closeProject') {
    project.closeProject()
    return
  }
  if (action === 'collapse') {
    editorUi.setShowProjectSidebar(false)
    return
  }

  if (ctx.kind === 'pair') {
    const path = ctx.path ?? ctx.pair.aspecPath
    if (action === 'openAspec') await openPair(ctx.pair, 'aspec')
    else if (action === 'openAsfl') await openPair(ctx.pair, 'asfl')
    else if (action === 'openGuispec') await openPair(ctx.pair, 'guispec')
    else if (action === 'openAll') await openPair(ctx.pair, 'all')
    else if (action === 'reveal') window.studio?.revealInFolder(path)
    else if (action === 'copyPath') await navigator.clipboard.writeText(path)
    return
  }

  if (ctx.kind === 'file') {
    if (action === 'reveal') window.studio?.revealInFolder(ctx.path)
    else if (action === 'copyPath') await navigator.clipboard.writeText(ctx.path)
  }
}
</script>

<template>
  <aside class="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-border-subtle bg-surface-raised">
    <div class="flex shrink-0 items-center gap-1 border-b border-border-subtle px-2 py-2">
      <div class="min-w-0 flex-1 px-1" :title="project.root ?? undefined">
        <p class="truncate text-xs font-semibold text-content-primary">
          {{ project.root ? folderName : t('sidebar.project') }}
        </p>
        <p v-if="project.root" class="truncate text-[10px] text-content-muted">{{ project.root }}</p>
      </div>
      <button
        type="button"
        class="rounded-md p-1.5 text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary disabled:opacity-40"
        :title="t('sidebar.refresh')"
        :disabled="busy || !project.root"
        @click="refresh()"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311-.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
      <DropdownMenu :items="headerMenuItems" teleport>
        <template #trigger="{ toggle }">
          <button
            type="button"
            class="rounded-md p-1.5 text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
            :title="t('sidebar.more')"
            @click="toggle"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z"
              />
            </svg>
          </button>
        </template>
      </DropdownMenu>
    </div>

    <div
      class="studio-scroll flex-1 overflow-y-auto p-3"
      @contextmenu.prevent="onPanelContext"
    >
      <div v-if="!project.root" class="flex flex-col items-center px-2 py-8 text-center">
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-7.5a1.5 1.5 0 0 0-.44-1.06l-2.12-2.12Z"
            />
          </svg>
        </div>
        <p class="text-sm text-content-secondary">{{ t('sidebar.noProject') }}</p>
        <button
          type="button"
          class="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          :disabled="busy"
          @click="onOpenFolder"
        >
          {{ busy ? t('sidebar.loading') : t('sidebar.openFolder') }}
        </button>
      </div>

      <p v-else-if="loading" class="px-1 text-xs text-content-muted">{{ t('sidebar.scanning') }}</p>

      <div v-else class="space-y-4">
        <section v-if="pairs.length">
          <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
            {{ t('sidebar.pairsTitle') }}
          </h3>
          <div class="space-y-2">
            <ProjectPairCard
              v-for="pair in pairs"
              :key="pair.aspecPath"
              :pair="pair"
              :active-path="activePath"
              :expanded="expandedPairs.has(pair.aspecPath)"
              @toggle="togglePair(pair.aspecPath)"
              @open-file="openFile"
              @contextmenu="(e, path) => onPairContext(e, pair, path)"
            />
          </div>
        </section>

        <section v-if="hasUnpaired">
          <button
            type="button"
            class="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-content-muted transition-colors hover:text-content-secondary"
            @click="showUnpaired = !showUnpaired"
          >
            <span>{{ t('sidebar.unpairedTitle') }}</span>
            <span class="normal-case tracking-normal">
              {{
                unpaired.asfl.length + unpaired.aspec.length + unpaired.guispec.length
              }}
            </span>
          </button>
          <div v-if="showUnpaired" class="space-y-2 rounded-lg border border-border-subtle p-2">
            <div v-if="unpaired.aspec.length">
              <p class="mb-1 px-1 text-[10px] font-medium uppercase text-content-muted">
                {{ t('sidebar.unpairedAspec', { count: unpaired.aspec.length }) }}
              </p>
              <ProjectFileRow
                v-for="file in unpaired.aspec"
                :key="file"
                :path="file"
                :active-path="activePath"
                @open="openFile"
                @contextmenu="(e) => onFileContext(e, file)"
              />
            </div>
            <div v-if="unpaired.asfl.length">
              <p class="mb-1 px-1 text-[10px] font-medium uppercase text-content-muted">
                {{ t('sidebar.unpairedAsfl', { count: unpaired.asfl.length }) }}
              </p>
              <ProjectFileRow
                v-for="file in unpaired.asfl"
                :key="file"
                :path="file"
                :active-path="activePath"
                @open="openFile"
                @contextmenu="(e) => onFileContext(e, file)"
              />
            </div>
            <div v-if="unpaired.guispec.length">
              <p class="mb-1 px-1 text-[10px] font-medium uppercase text-content-muted">
                {{ t('sidebar.unpairedGuispec', { count: unpaired.guispec.length }) }}
              </p>
              <ProjectFileRow
                v-for="file in unpaired.guispec"
                :key="file"
                :path="file"
                :active-path="activePath"
                @open="openFile"
                @contextmenu="(e) => onFileContext(e, file)"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <ProjectContextMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      :items="menuItems"
      @pick="handleMenuAction"
      @close="hideMenu()"
    />
  </aside>
</template>
