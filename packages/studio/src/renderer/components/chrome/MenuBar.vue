<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import DropdownMenu, { type MenuItem } from '../ui/DropdownMenu.vue'
import { useAppStore } from '../../stores/app'
import { useFileActions } from '../../composables/useFileActions'
import { useNewFileDialog } from '../../composables/useNewFileDialog'
import { useProjectStore } from '../../stores/projectStore'
import { useDocumentStore } from '../../stores/document'
import { useModalStore } from '../../stores/modal'

const emit = defineEmits<{ edit: [cmd: string]; devTools: []; format: []; refine: [] }>()

const { t } = useI18n()
const app = useAppStore()
const files = useFileActions()
const newFileDialog = useNewFileDialog()
const modal = useModalStore()
const project = useProjectStore()
const docStore = useDocumentStore()

const accessKeys: Record<string, string> = {
  file: 'f',
  edit: 'e',
  view: 'v',
  help: 'h'
}

const fileItems = computed<MenuItem[]>(() => [
  { id: 'new', label: t('menu.file.new'), shortcut: 'Ctrl+N', action: () => newFileDialog.show() },
  { id: 'newInformal', label: t('menu.file.newInformal'), action: () => docStore.newTab({ documentKind: 'aspec' }) },
  { id: 'open', label: t('menu.file.open'), shortcut: 'Ctrl+O', action: () => files.openFile() },
  { id: 'openFolder', label: t('menu.file.openFolder'), action: () => void project.openFolder() },
  { id: 'sep1', label: '', separator: true },
  { id: 'refine', label: t('menu.tools.refine'), action: () => emit('refine') },
  { id: 'sep1b', label: '', separator: true },
  { id: 'save', label: t('menu.file.save'), shortcut: 'Ctrl+S', action: () => files.saveTab() },
  { id: 'saveAs', label: t('menu.file.saveAs'), shortcut: 'Ctrl+Shift+S', action: () => files.saveAsTab() },
  { id: 'sep2', label: '', separator: true },
  { id: 'close', label: t('menu.file.closeTab'), shortcut: 'Ctrl+W', action: () => files.closeActiveTab() },
  { id: 'exit', label: t('menu.file.exit'), action: () => files.tryCloseWindow() }
])

const editItems = computed<MenuItem[]>(() => [
  { id: 'undo', label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', action: () => emit('edit', 'undo') },
  { id: 'redo', label: t('menu.edit.redo'), shortcut: 'Ctrl+Y', action: () => emit('edit', 'redo') },
  { id: 'sep1', label: '', separator: true },
  { id: 'cut', label: t('menu.edit.cut'), shortcut: 'Ctrl+X', action: () => emit('edit', 'cut') },
  { id: 'copy', label: t('menu.edit.copy'), shortcut: 'Ctrl+C', action: () => emit('edit', 'copy') },
  { id: 'paste', label: t('menu.edit.paste'), shortcut: 'Ctrl+V', action: () => emit('edit', 'paste') },
  { id: 'selectAll', label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A', action: () => emit('edit', 'selectAll') },
  { id: 'sep2', label: '', separator: true },
  { id: 'format', label: t('menu.edit.format'), shortcut: 'Shift+Alt+F', action: () => emit('format') }
])

const viewItems = computed<MenuItem[]>(() => [
  { id: 'light', label: t('menu.view.themeLight'), action: () => app.setTheme('light') },
  { id: 'dark', label: t('menu.view.themeDark'), action: () => app.setTheme('dark') },
  { id: 'system', label: t('menu.view.themeSystem'), action: () => app.setTheme('system') },
  { id: 'sep1', label: '', separator: true },
  { id: 'zh', label: t('menu.view.languageZh'), action: () => app.setLanguage('zh-CN') },
  { id: 'en', label: t('menu.view.languageEn'), action: () => app.setLanguage('en') }
])

const helpItems = computed<MenuItem[]>(() => [
  {
    id: 'devTools',
    label: t('menu.help.devTools'),
    shortcut: 'Ctrl+Shift+I',
    action: () => emit('devTools')
  },
  { id: 'sep0', label: '', separator: true },
  {
    id: 'about',
    label: t('menu.help.about'),
    action: () => {
      void modal.show({
        title: t('menu.help.about'),
        message: t('about.message'),
        buttons: [t('dialog.ok')]
      })
    }
  },
  {
    id: 'docs',
    label: t('menu.help.docs'),
    action: () => {
      void modal.show({
        title: t('menu.help.docs'),
        message: 'https://github.com/agile-sofl/agile-sofl-parser/tree/main/docs',
        buttons: [t('dialog.ok')]
      })
    }
  }
])

const menus = computed(() => [
  { key: 'file', label: t('menu.file'), items: fileItems.value },
  { key: 'edit', label: t('menu.edit'), items: editItems.value },
  { key: 'view', label: t('menu.view'), items: viewItems.value },
  { key: 'help', label: t('menu.help'), items: helpItems.value }
])
</script>

<template>
  <nav class="titlebar-no-drag flex items-center gap-0.5" role="menubar">
    <DropdownMenu v-for="menu in menus" :key="menu.key" :items="menu.items">
      <template #trigger="{ toggle }">
        <button
          type="button"
          role="menuitem"
          :accesskey="accessKeys[menu.key]"
          class="rounded-md px-2.5 py-0.5 text-[13px] text-content-secondary transition-colors duration-150 hover:bg-surface-overlay hover:text-content-primary active:scale-[0.98]"
          @click="toggle"
        >
          <span class="underline decoration-content-muted underline-offset-2">{{ menu.label[0] }}</span
          >{{ menu.label.slice(1) }}
        </button>
      </template>
    </DropdownMenu>
  </nav>
</template>
