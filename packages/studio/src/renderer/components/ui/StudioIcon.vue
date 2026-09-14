<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(
  defineProps<{
    icon: string
    size?: number | string
  }>(),
  { size: 16 }
)
</script>

<template>
  <Icon :icon="icon" :width="size" :height="size" class="inline-block shrink-0" aria-hidden="true" />
</template>
