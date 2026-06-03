"use strict";
const electron = require("electron");
const node_path = require("node:path");
const editorApi = require("@agile-sofl/editor-api");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_module = require("node:module");
const require$1 = node_module.createRequire(require("url").pathToFileURL(__filename).href);
let lspProcess = null;
function resolveServerEntry() {
  const pkgRoot = node_path.dirname(require$1.resolve("@agile-sofl/language-server/package.json"));
  return node_path.join(pkgRoot, "dist", "server.js");
}
function startLanguageServer() {
  if (lspProcess) return;
  const serverEntry = resolveServerEntry();
  if (!node_fs.existsSync(serverEntry)) {
    console.warn("[studio] language server not built; run npm run bundle --workspace @agile-sofl/language-server");
    return;
  }
  lspProcess = node_child_process.spawn(process.execPath, [serverEntry, "--stdio"], {
    cwd: node_path.dirname(serverEntry),
    stdio: ["pipe", "pipe", "inherit"]
  });
  lspProcess.on("exit", (code) => {
    console.log("[studio] language server exited", code);
    lspProcess = null;
  });
  lspProcess.stdout.on("data", (chunk) => {
    const preview = chunk.toString("utf8", 0, 80).replace(/\r?\n/g, " ");
    console.log("[studio] lsp stdout:", preview);
  });
  console.log("[studio] spawned language server at", serverEntry);
}
function stopLanguageServer() {
  if (!lspProcess) return;
  lspProcess.kill();
  lspProcess = null;
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "Agile-SOFL Studio"
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  startLanguageServer();
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopLanguageServer();
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.handle("studio:lsp-status", () => ({
  running: true,
  message: "Language server spawned from main process (stdio reference)"
}));
electron.ipcMain.handle("studio:build-document-model", (_event, source) => {
  const model = editorApi.buildDocumentModel(source);
  return {
    modules: model.modules.map((m) => m.name),
    errorCount: model.errorCount
  };
});
