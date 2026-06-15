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
  fileOpenDialog: (kind) => electron.ipcRenderer.invoke("studio:file-open-dialog", kind),
  fileSaveDialog: (defaultName, kind) => electron.ipcRenderer.invoke("studio:file-save-dialog", defaultName, kind),
  fileRead: (path) => electron.ipcRenderer.invoke("studio:file-read", path),
  fileWrite: (path, content) => electron.ipcRenderer.invoke("studio:file-write", path, content),
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
  buildModuleGraphLayout: (graph, options) => {
    const safeGraph = JSON.parse(JSON.stringify(graph));
    const safeOptions = options ? JSON.parse(JSON.stringify(options)) : void 0;
    return electron.ipcRenderer.invoke(
      "studio:build-module-graph-layout",
      safeGraph,
      safeOptions
    );
  },
  resetVisualChannel: (channelId) => electron.ipcRenderer.invoke("studio:reset-visual-channel", channelId),
  patchDocument: (payload) => electron.ipcRenderer.invoke("studio:patch-document", payload),
  formatDocument: (source) => electron.ipcRenderer.invoke("studio:format-document", source),
  patchDeclaration: (payload) => electron.ipcRenderer.invoke("studio:patch-declaration", payload),
  patchProcess: (payload) => electron.ipcRenderer.invoke("studio:patch-process", payload),
  patchFunction: (payload) => electron.ipcRenderer.invoke("studio:patch-function", payload),
  patchInvariant: (payload) => electron.ipcRenderer.invoke("studio:patch-invariant", payload),
  patchExt: (payload) => electron.ipcRenderer.invoke("studio:patch-ext", payload),
  patchProcessSignature: (payload) => electron.ipcRenderer.invoke("studio:patch-process-signature", payload),
  patchFunctionSignature: (payload) => electron.ipcRenderer.invoke("studio:patch-function-signature", payload),
  patchAlias: (payload) => electron.ipcRenderer.invoke("studio:patch-alias", payload),
  patchModule: (payload) => electron.ipcRenderer.invoke("studio:patch-module", payload),
  patchProcessInit: (payload) => electron.ipcRenderer.invoke("studio:patch-process-init", payload),
  parsePredicateUi: (text) => electron.ipcRenderer.invoke("studio:parse-predicate-ui", text),
  uiToPredicateText: (node) => electron.ipcRenderer.invoke("studio:ui-to-predicate-text", node),
  validateSignature: (kind, signature) => electron.ipcRenderer.invoke("studio:validate-signature", kind, signature),
  searchWorkspaceFiles: (rootDir, query) => electron.ipcRenderer.invoke("studio:search-workspace-files", rootDir, query),
  searchWorkspaceSymbols: (rootDir, query) => electron.ipcRenderer.invoke("studio:search-workspace-symbols", rootDir, query),
  openProjectFolder: () => electron.ipcRenderer.invoke("studio:open-project-folder"),
  buildInformalModel: (source) => electron.ipcRenderer.invoke("studio:build-informal-model", source),
  patchAspec: (payload) => electron.ipcRenderer.invoke("studio:patch-aspec", payload),
  refineAspec: (payload) => electron.ipcRenderer.invoke("studio:refine-aspec", payload),
  buildCoverageReport: (payload) => electron.ipcRenderer.invoke("studio:build-coverage-report", payload),
  patchInformal: (payload) => electron.ipcRenderer.invoke("studio:patch-informal", payload),
  buildHybridRegions: (source) => electron.ipcRenderer.invoke("studio:build-hybrid-regions", source),
  getInformalSpans: (source) => electron.ipcRenderer.invoke("studio:get-informal-spans", source),
  scanProject: (root) => electron.ipcRenderer.invoke("studio:scan-project", root),
  writeTraceFile: (filePath, traceJson) => electron.ipcRenderer.invoke("studio:write-trace-file", filePath, traceJson),
  formatAspec: (source) => electron.ipcRenderer.invoke("studio:format-aspec", source),
  buildGuiModel: (payload) => electron.ipcRenderer.invoke("studio:build-gui-model", payload),
  patchGui: (payload) => electron.ipcRenderer.invoke("studio:patch-gui", payload),
  formatGui: (source) => electron.ipcRenderer.invoke("studio:format-gui", source),
  resolveGuiForAspec: (payload) => electron.ipcRenderer.invoke("studio:resolve-gui-for-aspec", payload),
  patchAspecGui: (payload) => electron.ipcRenderer.invoke("studio:patch-aspec-gui", payload),
  findHybridSymbolSpan: (payload) => electron.ipcRenderer.invoke("studio:find-hybrid-symbol-span", payload)
};
electron.contextBridge.exposeInMainWorld("studio", studio);
