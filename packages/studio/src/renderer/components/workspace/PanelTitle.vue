<script setup lang="ts">
defineProps<{ title: string; dirty?: boolean }>()
</script>

<template>
  <div class="mr-auto flex min-w-0 items-center gap-1.5">
    <h2 class="min-w-0 truncate text-xs font-semibold text-content-primary">{{ title }}</h2>
    <span
      v-if="dirty"
      class="mt-px shrink-0 text-[10px] leading-none text-accent"
      :title="$t('visual.unsaved')"
    >●</span>
  </div>
</template>
