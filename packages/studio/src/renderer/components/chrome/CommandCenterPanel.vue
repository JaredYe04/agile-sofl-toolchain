<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCommandCenterStore } from '../../stores/commandCenter'
import CommandCenterList from './CommandCenterList.vue'

const { t } = useI18n()
const center = useCommandCenterStore()
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => center.isOpen,
  async (open) => {
    if (open) {
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  }
)

function onKeydown(e: KeyboardEvent): void {
  if (!center.isOpen) return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    center.close()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    center.moveSelection(1)
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    center.moveSelection(-1)
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    void center.executeSelected()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown, true))
onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="center.isOpen"
      class="fixed inset-0 z-[90] flex justify-center pt-[35px]"
      @click.self="center.close()"
    >
      <div
        class="titlebar-no-drag mx-4 mt-2 w-full max-w-2xl rounded-lg border border-border-subtle bg-surface-overlay shadow-lg animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        :aria-label="t('commandCenter.search')"
      >
        <div class="flex items-center gap-2 border-b border-border-subtle px-3 py-2">
          <svg class="h-4 w-4 shrink-0 text-content-muted" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.2" />
            <path
              d="M10.5 10.5 L14 14"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <input
            ref="inputEl"
            v-model="center.query"
            type="text"
            class="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-muted"
            :placeholder="t('commandCenter.search')"
            spellcheck="false"
          />
          <span v-if="center.loading" class="text-xs text-content-muted">{{ t('commandCenter.loading') }}</span>
        </div>

        <CommandCenterList
          :items="center.results"
          :selected-index="center.selectedIndex"
          @select="(i) => (center.selectedIndex = i)"
          @execute="(i) => center.executeItem(center.results[i])"
        />

        <div
          class="flex flex-wrap gap-x-3 gap-y-1 border-t border-border-subtle px-3 py-2 text-[10px] text-content-muted"
        >
          <span>{{ t('commandCenter.footer.hint') }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-in {
  animation: fade-in 150ms ease-out;
}
</style>
