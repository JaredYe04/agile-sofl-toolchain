import type { StudioApi } from '../../preload/index'

export {}

declare global {
  interface Window {
    studio?: StudioApi
  }
}

declare module 'vue-i18n' {
  export interface DefineLocaleMessage {
    'app.title': string
    'menu.file': string
    'menu.file.new': string
    'menu.file.open': string
    'menu.file.save': string
    'menu.file.saveAs': string
    'menu.file.closeTab': string
    'menu.file.exit': string
    'menu.edit': string
    'menu.edit.undo': string
    'menu.edit.redo': string
    'menu.edit.cut': string
    'menu.edit.copy': string
    'menu.edit.paste': string
    'menu.edit.selectAll': string
    'menu.view': string
    'menu.view.themeLight': string
    'menu.view.themeDark': string
    'menu.view.themeSystem': string
    'menu.view.languageZh': string
    'menu.view.languageEn': string
    'menu.help': string
    'menu.help.about': string
    'menu.help.docs': string
    'commandCenter.search': string
    'commandCenter.untitled': string
    'tab.untitled': string
    'window.minimize': string
    'window.maximize': string
    'window.restore': string
    'window.close': string
    'dialog.unsaved.title': string
    'dialog.unsaved.message': string
    'dialog.unsaved.save': string
    'dialog.unsaved.dontSave': string
    'dialog.unsaved.cancel': string
    'status.lsp.connected': string
    'status.lsp.disconnected': string
    'status.errors': string
    'status.noErrors': string
    'status.ready': string
    'about.message': string
  }
}
