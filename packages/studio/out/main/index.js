"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const node_fs = require("node:fs");
const node_child_process = require("node:child_process");
const node_module = require("node:module");
let cached = {};
let loaded = false;
function statePath() {
  return node_path.join(electron.app.getPath("userData"), "dialog-state.json");
}
async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await promises.readFile(statePath(), "utf8");
    cached = JSON.parse(raw);
  } catch {
    cached = {};
  }
}
async function getLastDialogDir() {
  await ensureLoaded();
  return cached.lastDir;
}
async function rememberDialogPath(filePath) {
  await ensureLoaded();
  cached.lastDir = node_path.dirname(filePath);
  try {
    await promises.writeFile(statePath(), JSON.stringify(cached), "utf8");
  } catch {
  }
}
function registerFileHandlers(getWindow2) {
  electron.ipcMain.handle("studio:file-read", async (_event, filePath) => {
    const content = await promises.readFile(filePath, "utf-8");
    return { filePath, content, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle("studio:file-write", async (_event, filePath, content) => {
    await promises.writeFile(filePath, content, "utf-8");
    return { filePath, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle("studio:file-open-dialog", async (_event, kind) => {
    const win = getWindow2();
    const lastDir = await getLastDialogDir();
    const filters = kind === "aspec" ? [{ name: "Informal Spec", extensions: ["aspec"] }] : kind === "asfl" ? [{ name: "Hybrid Spec", extensions: ["asfl"] }] : [
      { name: "Agile-SOFL Specs", extensions: ["asfl", "aspec"] },
      { name: "Hybrid (.asfl)", extensions: ["asfl"] },
      { name: "Informal (.aspec)", extensions: ["aspec"] }
    ];
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      filters,
      properties: ["openFile"],
      defaultPath: lastDir
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    await rememberDialogPath(filePath);
    const content = await promises.readFile(filePath, "utf-8");
    return { filePath, content, title: node_path.basename(filePath) };
  });
  electron.ipcMain.handle(
    "studio:file-save-dialog",
    async (_event, defaultName, kind = "asfl") => {
      const win = getWindow2();
      const lastDir = await getLastDialogDir();
      const ext = kind === "aspec" ? "aspec" : "asfl";
      const defaultPath = defaultName ?? `untitled.${ext}`;
      const result = await electron.dialog.showSaveDialog(win ?? void 0, {
        filters: [{ name: kind === "aspec" ? "Informal Spec" : "Hybrid Spec", extensions: [ext] }],
        defaultPath: lastDir ? joinLastDir(lastDir, defaultPath) : defaultPath
      });
      if (result.canceled || !result.filePath) return null;
      await rememberDialogPath(result.filePath);
      return result.filePath;
    }
  );
  electron.ipcMain.handle("studio:open-project-folder", async () => {
    const win = getWindow2();
    const lastDir = await getLastDialogDir();
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      properties: ["openDirectory"],
      defaultPath: lastDir
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const root = result.filePaths[0];
    await rememberDialogPath(root);
    return root;
  });
  electron.ipcMain.handle("studio:reveal-in-folder", (_event, filePath) => {
    electron.shell.showItemInFolder(filePath);
  });
}
function joinLastDir(dir, name) {
  return node_path.join(dir, name);
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
function resolveParseBridgePath() {
  const fromOut = node_path.join(electron.app.getAppPath(), "out/dist/parse-bridge.cjs");
  if (node_fs.existsSync(fromOut)) return fromOut;
  return node_path.join(electron.app.getAppPath(), "dist/parse-bridge.cjs");
}
function registerParseHandlers() {
  const { registerParseHandlers: registerBundled } = require(resolveParseBridgePath());
  registerBundled();
}
function toggleDevTools(win) {
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools();
  } else {
    win.webContents.openDevTools({ mode: "detach" });
  }
}
function attachDevToolsShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const isF12 = input.key === "F12";
    const isCtrlShiftI = (input.control || input.meta) && input.shift && input.key.toLowerCase() === "i";
    if (isF12 || isCtrlShiftI) {
      event.preventDefault();
      toggleDevTools(win);
    }
  });
}
function attachRendererDiagnostics(win) {
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[studio:renderer] did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[studio:renderer] render-process-gone", details);
  });
  if (electron.app.isPackaged) return;
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const tag = level === 3 ? "error" : level === 2 ? "warn" : "log";
    console[tag === "log" ? "log" : tag](`[studio:renderer:${tag}] ${message} (${sourceId}:${line})`);
  });
}
function openDevTools(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.openDevTools({ mode: "detach" });
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
let lspHandle = null;
let stdoutBuffer = "";
let running = false;
let statusMessage = "";
let mainWindow$1 = null;
let readyTimer = null;
let markedReady = false;
let isShuttingDown = false;
function canSendToRenderer() {
  return !isShuttingDown && mainWindow$1 !== null && !mainWindow$1.isDestroyed() && !mainWindow$1.webContents.isDestroyed();
}
function safeSend(channel, ...args) {
  if (!canSendToRenderer()) return;
  mainWindow$1.webContents.send(channel, ...args);
}
function resolveServerEntry() {
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "language-server", "server.js");
  }
  const pkgRoot = node_path.dirname(require$1.resolve("@agile-sofl/language-server/package.json"));
  return node_path.join(pkgRoot, "dist", "server.js");
}
function setLspWindow(win) {
  mainWindow$1 = win;
}
function isLspRunning() {
  return running && lspHandle !== null;
}
function getLspStatusMessage() {
  return statusMessage;
}
function broadcastStatus(runningNow, message) {
  running = runningNow;
  safeSend("studio:lsp-status-changed", {
    running: runningNow,
    message: statusMessage
  });
}
function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
}
function markRunningReady() {
  if (markedReady || !lspHandle) return;
  markedReady = true;
  clearReadyTimer();
  statusMessage = "Language server connected";
  broadcastStatus(true);
}
function scheduleReadyFallback() {
  clearReadyTimer();
  readyTimer = setTimeout(() => {
    if (lspHandle && !markedReady) markRunningReady();
  }, 300);
}
function attachStdout(onData) {
  if (!lspHandle) return;
  if (lspHandle.kind === "child") {
    lspHandle.proc.stdout.on("data", onData);
  } else {
    lspHandle.proc.stdout?.on("data", onData);
  }
}
function attachStderr(onData) {
  if (!lspHandle) return;
  if (lspHandle.kind === "child") {
    lspHandle.proc.stderr.on("data", onData);
  } else {
    lspHandle.proc.stderr?.on("data", onData);
  }
}
function attachExit(onExit) {
  if (!lspHandle) return;
  if (lspHandle.kind === "child") {
    lspHandle.proc.on("exit", onExit);
  } else {
    lspHandle.proc.on("exit", onExit);
  }
}
function writeStdin(data) {
  if (!lspHandle) return;
  if (lspHandle.kind === "child") {
    if (lspHandle.proc.stdin.writable) lspHandle.proc.stdin.write(data);
  } else {
    lspHandle.proc.stdin?.write(data);
  }
}
function killHandle() {
  if (!lspHandle) return;
  if (lspHandle.kind === "child") lspHandle.proc.kill();
  else lspHandle.proc.kill();
}
function wireProcess(label) {
  if (!lspHandle) return false;
  stdoutBuffer = "";
  markedReady = false;
  let stderrBuf = "";
  attachStdout((chunk) => {
    if (!markedReady) markRunningReady();
    stdoutBuffer += chunk.toString("utf8");
    const { messages, rest } = parseMessages(stdoutBuffer);
    stdoutBuffer = rest;
    for (const msg of messages) {
      safeSend("studio:lsp-message", msg);
    }
  });
  attachStderr((chunk) => {
    stderrBuf += chunk.toString("utf8");
    const text = chunk.toString("utf8").trim();
    if (text) console.error(`[studio] lsp stderr (${label}):`, text);
  });
  attachExit((code) => {
    clearReadyTimer();
    if (!isShuttingDown) {
      console.error(`[studio] language server exited (${label})`, code);
      if (stderrBuf.trim()) console.error("[studio] lsp stderr summary:", stderrBuf.trim().slice(0, 500));
    }
    lspHandle = null;
    markedReady = false;
    if (isShuttingDown) return;
    const hint = stderrBuf.trim().slice(0, 200) || "Run: npm run bundle --workspace @agile-sofl/language-server";
    statusMessage = `Language server failed (${label}): ${hint}`;
    broadcastStatus(false);
  });
  scheduleReadyFallback();
  console.log(`[studio] spawned language server via ${label}`);
  return true;
}
function tryUtilityProcess(serverEntry) {
  try {
    const proc = electron.utilityProcess.fork(serverEntry, ["--stdio"], {
      serviceName: "agile-sofl-lsp",
      stdio: "pipe",
      cwd: node_path.dirname(serverEntry)
    });
    lspHandle = { kind: "utility", proc };
    return wireProcess("utilityProcess");
  } catch (err) {
    console.warn("[studio] utilityProcess.fork failed:", err);
    lspHandle = null;
    return false;
  }
}
function tryNodeSpawn(serverEntry) {
  const nodeBin = process.env.npm_node_execpath ?? "node";
  try {
    const proc = node_child_process.spawn(nodeBin, [serverEntry, "--stdio"], {
      cwd: node_path.dirname(serverEntry),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    lspHandle = { kind: "child", proc };
    return wireProcess("node");
  } catch (err) {
    console.warn("[studio] node spawn failed:", err);
    lspHandle = null;
    return false;
  }
}
function tryElectronAsNode(serverEntry) {
  try {
    const proc = node_child_process.spawn(process.execPath, [serverEntry, "--stdio"], {
      cwd: node_path.dirname(serverEntry),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    lspHandle = { kind: "child", proc };
    return wireProcess("electron-as-node");
  } catch (err) {
    console.warn("[studio] electron-as-node spawn failed:", err);
    lspHandle = null;
    return false;
  }
}
function startLanguageServer() {
  if (lspHandle) return isLspRunning();
  isShuttingDown = false;
  const serverEntry = resolveServerEntry();
  if (!node_fs.existsSync(serverEntry)) {
    statusMessage = "Language server not built — run: npm run bundle --workspace @agile-sofl/language-server";
    console.warn("[studio]", statusMessage);
    broadcastStatus(false);
    return false;
  }
  const strategies = [
    () => tryNodeSpawn(serverEntry),
    () => tryElectronAsNode(serverEntry),
    () => tryUtilityProcess(serverEntry)
  ];
  for (const strategy of strategies) {
    if (strategy()) return true;
  }
  statusMessage = "Failed to spawn language server with all strategies";
  broadcastStatus(false);
  return false;
}
function sendToLanguageServer(jsonBody) {
  writeStdin(frameMessage(jsonBody));
}
function stopLanguageServer() {
  isShuttingDown = true;
  clearReadyTimer();
  if (!lspHandle) return;
  killHandle();
  lspHandle = null;
  running = false;
  markedReady = false;
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
  attachDevToolsShortcuts(mainWindow);
  attachRendererDiagnostics(mainWindow);
  mainWindow.on("closed", () => {
    setLspWindow(null);
    mainWindow = null;
  });
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
  mainWindow.webContents.once("did-finish-load", () => {
    startLanguageServer();
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
  if (!electron.app.isPackaged) {
    mainWindow.webContents.once("did-finish-load", () => {
      openDevTools(mainWindow);
    });
  }
}
electron.app.whenReady().then(() => {
  registerFileHandlers(getWindow);
  registerWindowHandlers(getWindow);
  try {
    registerParseHandlers();
  } catch (err) {
    console.error("[studio] Failed to register parse handlers:", err);
  }
  electron.ipcMain.on("studio:lsp-send", (_event, jsonBody) => {
    sendToLanguageServer(jsonBody);
  });
  electron.ipcMain.handle("studio:lsp-status", () => ({
    running: isLspRunning(),
    message: isLspRunning() ? getLspStatusMessage() || "Language server connected" : getLspStatusMessage() || "Language server not available — run npm run bundle --workspace @agile-sofl/language-server"
  }));
  electron.ipcMain.handle("studio:open-devtools", () => {
    openDevTools(mainWindow);
  });
  electron.ipcMain.on("studio:confirm-close", () => {
    allowClose = true;
    stopLanguageServer();
    setLspWindow(null);
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
