"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const node_module = require("node:module");
function registerFileHandlers(getWindow2) {
  electron.ipcMain.handle("studio:file-read", async (_event, filePath) => {
    const content = await promises.readFile(filePath, "utf-8");
    return { filePath, content, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle("studio:file-write", async (_event, filePath, content) => {
    await promises.writeFile(filePath, content, "utf-8");
    return { filePath, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle("studio:file-open-dialog", async () => {
    const win = getWindow2();
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      filters: [{ name: "Agile-SOFL", extensions: ["asfl"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const content = await promises.readFile(filePath, "utf-8");
    return { filePath, content, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle("studio:file-save-dialog", async (_event, defaultName) => {
    const win = getWindow2();
    const result = await electron.dialog.showSaveDialog(win ?? void 0, {
      filters: [{ name: "Agile-SOFL", extensions: ["asfl"] }],
      defaultPath: defaultName ?? "untitled.asfl"
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });
  electron.ipcMain.handle("studio:show-message-box", async (_event, options) => {
    const win = getWindow2();
    return electron.dialog.showMessageBox(win ?? void 0, options);
  });
}
function registerWindowHandlers(getWindow2) {
  electron.ipcMain.handle("studio:window-minimize", () => {
    getWindow2()?.minimize();
  });
  electron.ipcMain.handle("studio:window-maximize", () => {
    const win = getWindow2();
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });
  electron.ipcMain.handle("studio:window-close", () => {
    getWindow2()?.close();
  });
  electron.ipcMain.handle("studio:window-is-maximized", () => {
    return getWindow2()?.isMaximized() ?? false;
  });
  electron.ipcMain.handle("studio:app-get-locale", () => {
    return electron.app.getLocale();
  });
  electron.ipcMain.handle("studio:app-get-platform", () => {
    return process.platform;
  });
}
function parseMessages(buffer) {
  const messages = [];
  let rest = buffer;
  while (true) {
    const headerEnd = rest.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    const header = rest.slice(0, headerEnd);
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      rest = rest.slice(headerEnd + 4);
      continue;
    }
    const length = Number.parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (rest.length < bodyStart + length) break;
    messages.push(rest.slice(bodyStart, bodyStart + length));
    rest = rest.slice(bodyStart + length);
  }
  return { messages, rest };
}
function frameMessage(jsonBody) {
  return `Content-Length: ${Buffer.byteLength(jsonBody, "utf8")}\r
\r
${jsonBody}`;
}
const require$1 = node_module.createRequire(require("url").pathToFileURL(__filename).href);
let lspProcess = null;
let stdoutBuffer = "";
let running = false;
let mainWindow$1 = null;
function resolveServerEntry() {
  const pkgRoot = node_path.dirname(require$1.resolve("@agile-sofl/language-server/package.json"));
  return node_path.join(pkgRoot, "dist", "server.js");
}
function setLspWindow(win) {
  mainWindow$1 = win;
}
function isLspRunning() {
  return running && lspProcess !== null;
}
function startLanguageServer() {
  if (lspProcess) return true;
  const serverEntry = resolveServerEntry();
  if (!node_fs.existsSync(serverEntry)) {
    console.warn("[studio] language server not built; run npm run bundle --workspace @agile-sofl/language-server");
    running = false;
    return false;
  }
  lspProcess = node_child_process.spawn(process.execPath, [serverEntry, "--stdio"], {
    cwd: node_path.dirname(serverEntry),
    stdio: ["pipe", "pipe", "inherit"]
  });
  running = true;
  stdoutBuffer = "";
  lspProcess.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8");
    const { messages, rest } = parseMessages(stdoutBuffer);
    stdoutBuffer = rest;
    for (const msg of messages) {
      mainWindow$1?.webContents.send("studio:lsp-message", msg);
    }
  });
  lspProcess.on("exit", (code) => {
    console.log("[studio] language server exited", code);
    lspProcess = null;
    running = false;
    mainWindow$1?.webContents.send("studio:lsp-status-changed", { running: false });
  });
  console.log("[studio] spawned language server at", serverEntry);
  mainWindow$1?.webContents.send("studio:lsp-status-changed", { running: true });
  return true;
}
function sendToLanguageServer(jsonBody) {
  if (!lspProcess?.stdin.writable) return;
  lspProcess.stdin.write(frameMessage(jsonBody));
}
function stopLanguageServer() {
  if (!lspProcess) return;
  lspProcess.kill();
  lspProcess = null;
  running = false;
}
let mainWindow = null;
let allowClose = false;
function getWindow() {
  return mainWindow;
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "Agile-SOFL Studio"
  });
  setLspWindow(mainWindow);
  startLanguageServer();
  mainWindow.on("close", (e) => {
    if (allowClose) return;
    e.preventDefault();
    mainWindow?.webContents.send("studio:request-close");
  });
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("studio:window-maximized-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("studio:window-maximized-changed", false);
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  registerFileHandlers(getWindow);
  registerWindowHandlers(getWindow);
  electron.ipcMain.on("studio:lsp-send", (_event, jsonBody) => {
    sendToLanguageServer(jsonBody);
  });
  electron.ipcMain.handle("studio:lsp-status", () => ({
    running: isLspRunning(),
    message: isLspRunning() ? "Language server connected" : "Language server not available — run npm run bundle --workspace @agile-sofl/language-server"
  }));
  electron.ipcMain.on("studio:confirm-close", () => {
    allowClose = true;
    mainWindow?.close();
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopLanguageServer();
  if (process.platform !== "darwin") electron.app.quit();
});
