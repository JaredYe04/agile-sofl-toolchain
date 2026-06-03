import { useI18n } from 'vue-i18n'
import { useDocumentStore } from '../stores/document'

export function useFileActions() {
  const { t } = useI18n()
  const doc = useDocumentStore()

  async function saveTab(tabId?: string): Promise<boolean> {
    const tab = tabId ? doc.tabs.find((x) => x.id === tabId) : doc.activeTab
    if (!tab) return false

    let path = tab.filePath
    if (!path) {
      path = await window.studio!.fileSaveDialog(`${tab.title}.asfl`)
      if (!path) return false
    }

    await window.studio!.fileWrite(path, tab.content)
    doc.markSaved(tab.id, path, path.split(/[/\\]/).pop() ?? tab.title)
    return true
  }

  async function saveAsTab(): Promise<boolean> {
    const tab = doc.activeTab
    if (!tab) return false
    const path = await window.studio!.fileSaveDialog(`${tab.title}.asfl`)
    if (!path) return false
    await window.studio!.fileWrite(path, tab.content)
    doc.markSaved(tab.id, path, path.split(/[/\\]/).pop() ?? tab.title)
    return true
  }

  async function openFile(): Promise<void> {
    const result = await window.studio!.fileOpenDialog()
    if (result) doc.openFromFile(result.filePath, result.content, result.title)
  }

  async function confirmCloseTab(tabId: string): Promise<'save' | 'discard' | 'cancel'> {
    const tab = doc.tabs.find((t) => t.id === tabId)
    if (!tab?.isDirty) return 'discard'

    const res = await window.studio!.showMessageBox({
      type: 'warning',
      buttons: [t('dialog.unsaved.save'), t('dialog.unsaved.dontSave'), t('dialog.unsaved.cancel')],
      defaultId: 0,
      cancelId: 2,
      title: t('dialog.unsaved.title'),
      message: t('dialog.unsaved.message', { name: tab.title })
    })

    if (res.response === 0) {
      const saved = await saveTab(tabId)
      return saved ? 'save' : 'cancel'
    }
    if (res.response === 1) return 'discard'
    return 'cancel'
  }

  async function closeActiveTab(): Promise<void> {
    const tab = doc.activeTab
    if (!tab) return
    const action = await confirmCloseTab(tab.id)
    if (action === 'cancel') return
    doc.removeTab(tab.id)
  }

  async function tryCloseWindow(): Promise<void> {
    const dirtyTabs = doc.tabs.filter((t) => t.isDirty)
    for (const tab of dirtyTabs) {
      doc.setActive(tab.id)
      const action = await confirmCloseTab(tab.id)
      if (action === 'cancel') return
      if (action === 'discard') {
        tab.isDirty = false
      }
    }
    if (!doc.tabs.some((t) => t.isDirty)) {
      window.studio!.confirmClose()
    }
  }

  return {
    saveTab,
    saveAsTab,
    openFile,
    closeActiveTab,
    tryCloseWindow,
    confirmCloseTab
  }
}
