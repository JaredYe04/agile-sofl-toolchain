<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

export interface MenuItem {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  action?: () => void
  separator?: boolean
}

const props = defineProps<{ items: MenuItem[] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function close(): void {
  open.value = false
}

function onSelect(item: MenuItem): void {
  if (item.disabled || item.separator) return
  item.action?.()
  close()
}

function onDocClick(e: MouseEvent): void {
  if (!root.value?.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="root" class="titlebar-no-drag relative">
    <slot name="trigger" :toggle="toggle" :open="open" />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        role="menu"
        class="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border-subtle bg-surface-overlay py-1 shadow-lg"
      >
        <template v-for="item in items" :key="item.id">
          <div v-if="item.separator" class="my-1 border-t border-border-subtle" />
          <button
            v-else
            role="menuitem"
            type="button"
            class="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-content-primary transition-colors duration-150 hover:bg-accent/10 disabled:opacity-40"
            :disabled="item.disabled"
            @click="onSelect(item)"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.shortcut" class="ml-6 text-xs text-content-muted">{{ item.shortcut }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>
