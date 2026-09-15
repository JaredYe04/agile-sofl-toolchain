<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DropdownMenu, { type MenuItem } from '../../../ui/DropdownMenu.vue'
import IconActionButton from '../../../ui/IconActionButton.vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  edit: []
  remove: []
}>()

const { t } = useI18n()

const items = computed((): MenuItem[] => [
  { id: 'edit', label: t('visual.entity.edit'), disabled: props.disabled, action: () => emit('edit') },
  { id: 'remove', label: t('visual.entity.delete'), danger: true, disabled: props.disabled, action: () => emit('remove') }
])
</script>

<template>
  <DropdownMenu :items="items" teleport>
    <template #trigger="{ toggle }">
      <IconActionButton
        icon="lucide:ellipsis"
        :label="t('visual.entity.more')"
        :disabled="disabled"
        @click.stop="toggle"
      />
    </template>
  </DropdownMenu>
</template>
