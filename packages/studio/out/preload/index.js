"use strict";
const electron = require("electron");
const studio = {
  minimize: () => electron.ipcRenderer.invoke("studio:window-minimize"),
  maximize: () => electron.ipcRenderer.invoke("studio:window-maximize"),
  close: () => electron.ipcRenderer.invoke("studio:window-close"),
  isMaximized: () => electron.ipcRenderer.invoke("studio:window-is-maximized"),
  getPlatform: () => electron.ipcRenderer.invoke("studio:app-get-platform"),
  getLocale: () => electron.ipcRenderer.invoke("studio:app-get-locale"),
  openDevTools: () => electron.ipcRenderer.invoke("studio:open-devtools"),
  onMaximizedChanged: (cb) => {
    const handler = (_, maximized) => cb(maximized);
    electron.ipcRenderer.on("studio:window-maximized-changed", handler);
    return () => electron.ipcRenderer.removeListener("studio:window-maximized-changed", handler);
  },
  onRequestClose: (cb) => {
    const handler = () => cb();
    electron.ipcRenderer.on("studio:request-close", handler);
    return () => electron.ipcRenderer.removeListener("studio:request-close", handler);
  },
  confirmClose: () => electron.ipcRenderer.send("studio:confirm-close"),
  fileOpenDialog: () => electron.ipcRenderer.invoke("studio:file-open-dialog"),
  fileSaveDialog: (defaultName) => electron.ipcRenderer.invoke("studio:file-save-dialog", defaultName),
  fileRead: (path) => electron.ipcRenderer.invoke("studio:file-read", path),
  fileWrite: (path, content) => electron.ipcRenderer.invoke("studio:file-write", path, content),
  showMessageBox: (options) => electron.ipcRenderer.invoke("studio:show-message-box", options),
  lspSend: (jsonBody) => electron.ipcRenderer.send("studio:lsp-send", jsonBody),
  lspOnMessage: (cb) => {
    const handler = (_, message) => cb(message);
    electron.ipcRenderer.on("studio:lsp-message", handler);
    return () => electron.ipcRenderer.removeListener("studio:lsp-message", handler);
  },
  lspOnStatusChanged: (cb) => {
    const handler = (_, status) => cb(status);
    electron.ipcRenderer.on("studio:lsp-status-changed", handler);
    return () => electron.ipcRenderer.removeListener("studio:lsp-status-changed", handler);
  },
  getLspStatus: () => electron.ipcRenderer.invoke("studio:lsp-status"),
  buildVisualModel: (source, channelId) => electron.ipcRenderer.invoke("studio:build-visual-model", source, channelId),
  resetVisualChannel: (channelId) => electron.ipcRenderer.invoke("studio:reset-visual-channel", channelId),
  patchDocument: (payload) => electron.ipcRenderer.invoke("studio:patch-document", payload)
};
electron.contextBridge.exposeInMainWorld("studio", studio);
