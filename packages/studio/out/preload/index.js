"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("studio", {
  getLspStatus: () => electron.ipcRenderer.invoke("studio:lsp-status"),
  buildDocumentModel: (source) => electron.ipcRenderer.invoke("studio:build-document-model", source)
});
