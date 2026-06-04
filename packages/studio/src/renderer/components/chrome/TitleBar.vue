<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../../stores/app'
import MenuBar from './MenuBar.vue'
import CommandCenter from './CommandCenter.vue'
import WindowControls from './WindowControls.vue'

defineEmits<{ edit: [cmd: string]; devTools: []; format: [] }>()

const app = useAppStore()
const isDarwin = computed(() => app.platform === 'darwin')
</script>

<template>
  <header
    class="titlebar-drag flex h-[35px] shrink-0 items-center border-b border-border-subtle bg-surface-raised select-none"
  >
    <div
      class="titlebar-no-drag flex items-center gap-2"
      :class="isDarwin ? 'pl-[78px]' : 'pl-2'"
    >
      <div class="flex h-4 w-4 items-center justify-center rounded bg-accent/20 text-[10px] font-bold text-accent">
        A
      </div>
      <MenuBar @edit="$emit('edit', $event)" @dev-tools="$emit('devTools')" @format="$emit('format')" />
    </div>

    <div class="titlebar-drag flex min-w-0 flex-1 items-center justify-center">
      <CommandCenter />
    </div>

    <WindowControls />
  </header>
</template>
