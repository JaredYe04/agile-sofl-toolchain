<script setup lang="ts">
defineProps<{
  title?: string
  subtitle?: string
}>()
</script>

<template>
  <section class="rounded-lg border border-border-subtle bg-surface-raised p-4">
    <header v-if="title || $slots.title" class="mb-3 border-b border-border-subtle pb-2">
      <slot name="title">
        <h3 v-if="title" class="text-sm font-semibold text-content-primary">{{ title }}</h3>
        <p v-if="subtitle" class="mt-0.5 text-xs text-content-muted">{{ subtitle }}</p>
      </slot>
    </header>
    <slot />
  </section>
</template>
