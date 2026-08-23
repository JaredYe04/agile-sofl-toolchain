"use strict";
const electron = require("electron");
const node_path = require("node:path");
const promises = require("node:fs/promises");
const node_fs = require("node:fs");
const node_crypto = require("node:crypto");
const node_url = require("node:url");
const initSqlJs = require("sql.js");
const node_module = require("node:module");
const node_child_process = require("node:child_process");
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
const MANIFEST_FILENAME = ".agile-sofl.json";
const DEFAULT_COLUMN_WIDTHS = [0.18, 0.22, 0.38, 0.22];
let SQL = null;
let db = null;
let dbPath = null;
function resolveSqlWasm() {
  const require$12 = node_module.createRequire(require("url").pathToFileURL(__filename).href);
  try {
    return require$12.resolve("sql.js/dist/sql-wasm.wasm");
  } catch {
    const here = node_path.dirname(node_url.fileURLToPath(require("url").pathToFileURL(__filename).href));
    const candidates = [
      node_path.join(process.cwd(), "node_modules/sql.js/dist/sql-wasm.wasm"),
      node_path.join(process.cwd(), "packages/studio/node_modules/sql.js/dist/sql-wasm.wasm"),
      node_path.join(here, "../../../../node_modules/sql.js/dist/sql-wasm.wasm"),
      node_path.join(here, "../../../node_modules/sql.js/dist/sql-wasm.wasm")
    ];
    for (const candidate of candidates) {
      if (node_fs.existsSync(candidate)) return candidate;
    }
    throw new Error("sql.js wasm not found");
  }
}
async function getSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    wasmBinary: node_fs.readFileSync(resolveSqlWasm())
  });
  return SQL;
}
function persist() {
  if (!db || !dbPath) return;
  node_fs.mkdirSync(node_path.dirname(dbPath), { recursive: true });
  node_fs.writeFileSync(dbPath, Buffer.from(db.export()));
}
function migrate(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_opened_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      is_gui INTEGER NOT NULL DEFAULT 0,
      parent_name TEXT,
      cached_json TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      content_hash TEXT,
      mtime INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS ui_state (
      project_id TEXT PRIMARY KEY,
      informal_collapsed INTEGER NOT NULL DEFAULT 0,
      column_widths TEXT,
      selected_module TEXT,
      expanded INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
}
async function openProjectIndex(filePath) {
  const sql = await getSql();
  dbPath = filePath;
  if (node_fs.existsSync(filePath)) {
    db = new sql.Database(node_fs.readFileSync(filePath));
  } else {
    node_fs.mkdirSync(node_path.dirname(filePath), { recursive: true });
    db = new sql.Database();
  }
  migrate(db);
  persist();
}
function requireDb() {
  if (!db) throw new Error("Project index database is not open");
  return db;
}
function listProjects() {
  const database = requireDb();
  const stmt = database.prepare(
    "SELECT id, name, root_path, created_at, last_opened_at FROM projects ORDER BY last_opened_at DESC"
  );
  const rows = [];
  while (stmt.step()) {
    const r = stmt.getAsObject();
    rows.push({
      id: r.id,
      name: r.name,
      rootPath: r.root_path,
      createdAt: r.created_at,
      lastOpenedAt: r.last_opened_at
    });
  }
  stmt.free();
  return rows;
}
function upsertProject(input) {
  const database = requireDb();
  const now = Date.now();
  const existing = database.prepare("SELECT id, created_at FROM projects WHERE root_path = ?");
  existing.bind([input.rootPath]);
  if (existing.step()) {
    const row = existing.getAsObject();
    existing.free();
    database.run("UPDATE projects SET name = ?, last_opened_at = ? WHERE id = ?", [
      input.name,
      now,
      row.id
    ]);
    persist();
    return {
      id: row.id,
      name: input.name,
      rootPath: input.rootPath,
      createdAt: row.created_at,
      lastOpenedAt: now
    };
  }
  existing.free();
  const id = input.id ?? node_crypto.randomUUID();
  database.run(
    "INSERT INTO projects (id, name, root_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)",
    [id, input.name, input.rootPath, now, now]
  );
  persist();
  return { id, name: input.name, rootPath: input.rootPath, createdAt: now, lastOpenedAt: now };
}
function touchProject(id) {
  requireDb().run("UPDATE projects SET last_opened_at = ? WHERE id = ?", [Date.now(), id]);
  persist();
}
function removeProject(id) {
  const database = requireDb();
  database.run("DELETE FROM modules WHERE project_id = ?", [id]);
  database.run("DELETE FROM files WHERE project_id = ?", [id]);
  database.run("DELETE FROM ui_state WHERE project_id = ?", [id]);
  database.run("DELETE FROM projects WHERE id = ?", [id]);
  persist();
}
function replaceProjectModules(projectId, modules) {
  const database = requireDb();
  database.run("DELETE FROM modules WHERE project_id = ?", [projectId]);
  const stmt = database.prepare(
    "INSERT INTO modules (project_id, name, file_path, is_gui, parent_name, cached_json) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const mod of modules) {
    stmt.run([
      projectId,
      mod.name,
      mod.filePath,
      mod.isGui ? 1 : 0,
      mod.parentName ?? null,
      JSON.stringify(mod)
    ]);
  }
  stmt.free();
  persist();
}
function cachedModules(projectId) {
  const database = requireDb();
  const stmt = database.prepare("SELECT cached_json FROM modules WHERE project_id = ?");
  stmt.bind([projectId]);
  const out = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    try {
      out.push(JSON.parse(row.cached_json));
    } catch {
    }
  }
  stmt.free();
  return out;
}
function getUiState(projectId) {
  const database = requireDb();
  const stmt = database.prepare(
    "SELECT informal_collapsed, column_widths, selected_module, expanded FROM ui_state WHERE project_id = ?"
  );
  stmt.bind([projectId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    let widths = DEFAULT_COLUMN_WIDTHS;
    try {
      if (row.column_widths) widths = JSON.parse(row.column_widths);
    } catch {
      widths = DEFAULT_COLUMN_WIDTHS;
    }
    return {
      informalCollapsed: Boolean(row.informal_collapsed),
      columnWidths: widths.length === 4 ? widths : DEFAULT_COLUMN_WIDTHS,
      selectedModuleName: typeof row.selected_module === "string" ? row.selected_module : null,
      expanded: row.expanded !== 0
    };
  }
  stmt.free();
  return {
    informalCollapsed: false,
    columnWidths: [...DEFAULT_COLUMN_WIDTHS],
    selectedModuleName: null,
    expanded: true
  };
}
function saveUiState(projectId, state) {
  requireDb().run(
    `INSERT INTO ui_state (project_id, informal_collapsed, column_widths, selected_module, expanded)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET
       informal_collapsed = excluded.informal_collapsed,
       column_widths = excluded.column_widths,
       selected_module = excluded.selected_module,
       expanded = excluded.expanded`,
    [
      projectId,
      state.informalCollapsed ? 1 : 0,
      JSON.stringify(state.columnWidths),
      state.selectedModuleName,
      state.expanded ? 1 : 0
    ]
  );
  persist();
}
const SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", ".git"]);
function scanSpecFiles(root, ext, out = []) {
  if (!node_fs.existsSync(root)) return out;
  for (const name of node_fs.readdirSync(root)) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const full = node_path.join(root, name);
    const st = node_fs.statSync(full);
    if (st.isDirectory()) scanSpecFiles(full, ext, out);
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}
function scanProjectRoot(root) {
  return {
    aspecFiles: scanSpecFiles(root, ".aspec"),
    asflFiles: scanSpecFiles(root, ".asfl"),
    guispecFiles: scanSpecFiles(root, ".guispec")
  };
}
function manifestPath(root) {
  return node_path.join(root, MANIFEST_FILENAME);
}
function readManifest(root) {
  const path = manifestPath(root);
  if (!node_fs.existsSync(path)) return null;
  try {
    const raw = JSON.parse(node_fs.readFileSync(path, "utf-8"));
    if (!raw || typeof raw.name !== "string") return null;
    return normalizeManifest(raw, node_path.basename(root));
  } catch {
    return null;
  }
}
function writeManifest(root, manifest) {
  node_fs.writeFileSync(manifestPath(root), `${JSON.stringify(manifest, null, 2)}
`, "utf-8");
}
function normalizeManifest(raw, fallbackName) {
  const hybrid = Array.isArray(raw.hybrid) ? raw.hybrid.filter((p) => typeof p === "string" && p.length > 0) : [];
  return {
    version: "1.0",
    name: raw.name?.trim() || fallbackName,
    guiModule: raw.guiModule?.trim() || void 0,
    informal: raw.informal?.trim() || "informal.aspec",
    hybrid: hybrid.length ? hybrid : ["hybrid.asfl"],
    gui: raw.gui?.trim() || void 0
  };
}
async function loadOrCreateManifest(root) {
  const existing = readManifest(root);
  if (existing) return existing;
  const inferred = await inferManifest(root);
  writeManifest(root, inferred);
  return inferred;
}
async function inferManifest(root) {
  const scan = scanProjectRoot(root);
  const informalRel = toRel(root, scan.aspecFiles[0]) ?? "informal.aspec";
  const hybrid = scan.asflFiles.map((p) => toRel(root, p)).filter(Boolean);
  const guiRel = toRel(root, scan.guispecFiles[0]);
  const base = node_path.basename(scan.aspecFiles[0] ?? "", ".aspec");
  const pairGui = scan.guispecFiles.find((p) => node_path.basename(p, ".guispec") === `${base}-gui`) ?? scan.guispecFiles.find((p) => node_path.basename(p, ".guispec") === base.replace(/-informal$/, "") + "-gui");
  return {
    version: "1.0",
    name: node_path.basename(root),
    informal: informalRel,
    hybrid: hybrid.length ? hybrid : ["hybrid.asfl"],
    gui: guiRel ?? (pairGui ? toRel(root, pairGui) : void 0)
  };
}
function toRel(root, abs) {
  if (!abs) return void 0;
  return node_path.relative(root, abs).replace(/\\/g, "/");
}
function slugifyProjectName(name) {
  const slug = name.trim().replace(/[^\w\u4e00-\u9fff-]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || "NewSystem";
}
function asflIdent(name) {
  const ident = slugifyProjectName(name).replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(ident) ? ident : `System_${ident}`;
}
function createProjectTemplate(root, name) {
  node_fs.mkdirSync(root, { recursive: true });
  const ident = asflIdent(name);
  const informal = "informal.aspec";
  const hybrid = "hybrid.asfl";
  const gui = "gui.guispec";
  const manifest = {
    version: "1.0",
    name,
    guiModule: "GUI_App",
    informal,
    hybrid: [hybrid],
    gui
  };
  const aspecId = node_crypto.randomUUID();
  node_fs.writeFileSync(
    node_path.join(root, informal),
    `aspecVersion: "1.0"
meta:
  id: "${aspecId}"
  title: ${JSON.stringify(name)}
  hybridTarget: ./${hybrid}
  guiTarget: ./${gui}
system:
  name: ${ident}
  purpose: |
    Describe the system purpose here.
modules: []
`,
    "utf-8"
  );
  node_fs.writeFileSync(
    node_path.join(root, hybrid),
    `module SYSTEM_${ident};
end_module
module GUI_App / ${ident};
const
    view_home = 0;
    view_next = 1;
type
    ViewId = nat;
var
    current_view: ViewId;
inv
    current_view >= 0 and current_view <= 1;
gui AppGui;
screen Home;
    label welcome "Welcome";
    navigation goNext "Open" triggers OpenNext;
end_screen;
screen Next;
    label body "Next view";
    navigation goHome "Back" triggers OpenHome;
end_screen;
end_gui;
process OpenNext ()
    FSF :
    others && current_view = 1
end_process
process OpenHome ()
    FSF :
    others && current_view = 0
end_process
end_module
`,
    "utf-8"
  );
  node_fs.writeFileSync(
    node_path.join(root, gui),
    `guispecVersion: "1.0"
meta:
  id: "${node_crypto.randomUUID()}"
  title: ${JSON.stringify(`${name} GUI`)}
  informalTarget: ./${informal}
gui:
  app:
    name: ${ident}App
    description: |
      Application views.
  screens:
    - id: view-home
      name: Home
      title: Home
      size:
        width: 640
        height: 400
      widgets:
        - id: w-title
          kind: label
          label: Welcome
          bounds: { x: 24, y: 24, width: 240, height: 32 }
        - id: w-open
          kind: navigation
          label: Open
          bounds: { x: 24, y: 72, width: 120, height: 32 }
          events:
            - on: click
              action: navigate
              targetView: view-next
    - id: view-next
      name: Next
      title: Next
      size:
        width: 640
        height: 400
      widgets:
        - id: w-next
          kind: label
          label: Next view
          bounds: { x: 24, y: 24, width: 240, height: 32 }
        - id: w-back
          kind: navigation
          label: Back
          bounds: { x: 24, y: 72, width: 120, height: 32 }
          events:
            - on: click
              action: navigate
              targetView: view-home
  flows:
    - from: view-home
      to: view-next
      on: navigate
      label: Open next
    - from: view-next
      to: view-home
      on: navigate
      label: Back home
`,
    "utf-8"
  );
  writeManifest(root, manifest);
  return manifest;
}
const STANDARD_INFORMAL = "informal.aspec";
const STANDARD_HYBRID = "hybrid.asfl";
const STANDARD_GUI = "gui.guispec";
function resolveTemplatesDir() {
  const candidates = [
    node_path.join(__dirname, "../renderer/templates"),
    node_path.join(__dirname, "../../public/templates"),
    node_path.join(electron.app.getAppPath(), "public/templates")
  ];
  for (const dir of candidates) {
    if (node_fs.existsSync(node_path.join(dir, "project-manifest.json"))) return dir;
  }
  throw new Error("Project templates directory not found");
}
function loadProjectTemplateManifest(templatesDir) {
  const dir = templatesDir ?? resolveTemplatesDir();
  const raw = JSON.parse(node_fs.readFileSync(node_path.join(dir, "project-manifest.json"), "utf-8"));
  return raw.templates;
}
function findProjectTemplate(templateId, templatesDir) {
  return loadProjectTemplateManifest(templatesDir).find((entry) => entry.id === templateId);
}
function readTemplateFile(templatesDir, file) {
  return node_fs.readFileSync(node_path.join(templatesDir, file), "utf-8");
}
function rewriteCrossRefs(content, entry, projectName) {
  let out = content;
  const hybridSrc = entry.hybrid?.[0];
  if (hybridSrc) {
    out = out.replaceAll(`./${hybridSrc}`, `./${STANDARD_HYBRID}`);
    out = out.replaceAll(hybridSrc, STANDARD_HYBRID);
  }
  if (entry.informal) {
    out = out.replaceAll(`./${entry.informal}`, `./${STANDARD_INFORMAL}`);
    out = out.replaceAll(entry.informal, STANDARD_INFORMAL);
  }
  if (entry.gui) {
    out = out.replaceAll(`./${entry.gui}`, `./${STANDARD_GUI}`);
    out = out.replaceAll(entry.gui, STANDARD_GUI);
  }
  if (out.includes("title:")) {
    out = out.replace(/title:\s*.+/m, `title: ${JSON.stringify(projectName)}`);
  }
  return out;
}
function inferSystemModuleName(asflContent) {
  const match = asflContent.match(/module\s+(SYSTEM_\w+|\w+)\s*;/);
  return match?.[1] ?? "NewSystem";
}
function writeStubInformal(root, projectName, hybridContent) {
  const systemName = inferSystemModuleName(hybridContent);
  const ident = asflIdent(projectName);
  node_fs.writeFileSync(
    node_path.join(root, STANDARD_INFORMAL),
    `aspecVersion: "1.0"
meta:
  id: "${node_crypto.randomUUID()}"
  title: ${JSON.stringify(projectName)}
  hybridTarget: ./${STANDARD_HYBRID}
system:
  name: ${ident}
  purpose: |
    Informal specification for ${systemName.replace(/^SYSTEM_/, "")}.
modules: []
`,
    "utf-8"
  );
}
function appendGuiModule(hybrid, guiSrc) {
  if (/\bmodule\s+GUI_/.test(hybrid)) return hybrid;
  const body = hybrid.replace(/\s*$/, "\n");
  const snippet = guiSrc.endsWith("\n") ? guiSrc : `${guiSrc}
`;
  return `${body}${snippet}`;
}
function createProjectFromTemplate(root, name, templateId, templatesDir) {
  const dir = resolveTemplatesDir();
  const entry = findProjectTemplate(templateId, dir);
  if (!entry) {
    throw new Error(`Unknown project template: ${templateId}`);
  }
  if (entry.useEmptyProject) {
    return createProjectTemplate(root, name);
  }
  node_fs.mkdirSync(root, { recursive: true });
  const hybridSources = entry.hybrid ?? [];
  if (hybridSources.length === 0) {
    throw new Error(`Project template "${templateId}" has no hybrid files`);
  }
  const hybridPaths = [];
  if (hybridSources.length === 1) {
    let hybridContent = readTemplateFile(dir, hybridSources[0]);
    if (entry.guiHybrid) {
      hybridContent = appendGuiModule(hybridContent, readTemplateFile(dir, entry.guiHybrid));
    }
    node_fs.writeFileSync(node_path.join(root, STANDARD_HYBRID), hybridContent, "utf-8");
    hybridPaths.push(STANDARD_HYBRID);
    if (entry.informal) {
      const informalContent = rewriteCrossRefs(
        readTemplateFile(dir, entry.informal),
        entry,
        name
      );
      node_fs.writeFileSync(node_path.join(root, STANDARD_INFORMAL), informalContent, "utf-8");
    } else {
      writeStubInformal(root, name, hybridContent);
    }
  } else {
    let firstContent = "";
    for (const src of hybridSources) {
      const dest = node_path.basename(src);
      const content = readTemplateFile(dir, src);
      node_fs.writeFileSync(node_path.join(root, dest), content, "utf-8");
      hybridPaths.push(dest);
      if (!firstContent) firstContent = content;
    }
    if (entry.informal) {
      node_fs.writeFileSync(
        node_path.join(root, STANDARD_INFORMAL),
        rewriteCrossRefs(readTemplateFile(dir, entry.informal), entry, name),
        "utf-8"
      );
    } else {
      writeStubInformal(root, name, firstContent);
    }
  }
  let guiPath;
  if (entry.gui) {
    const guiContent = rewriteCrossRefs(readTemplateFile(dir, entry.gui), entry, name);
    node_fs.writeFileSync(node_path.join(root, STANDARD_GUI), guiContent, "utf-8");
    guiPath = STANDARD_GUI;
  }
  const manifest = normalizeManifest(
    {
      name,
      informal: STANDARD_INFORMAL,
      hybrid: hybridPaths,
      gui: guiPath,
      guiModule: guiPath ? entry.guiModule ?? "GUI_App" : entry.guiModule
    },
    node_path.basename(root)
  );
  writeManifest(root, manifest);
  return manifest;
}
async function initProjectIndex() {
  const file = node_path.join(electron.app.getPath("userData"), "studio-index.sqlite");
  await openProjectIndex(file);
}
function registerProjectHandlers(getWindow2) {
  electron.ipcMain.handle("studio:project-list", () => listProjects());
  electron.ipcMain.handle("studio:project-ui-state", (_event, projectId) => getUiState(projectId));
  electron.ipcMain.handle(
    "studio:project-save-ui-state",
    (_event, projectId, state) => {
      saveUiState(projectId, state);
      return true;
    }
  );
  electron.ipcMain.handle(
    "studio:project-cached-modules",
    (_event, projectId) => cachedModules(projectId)
  );
  electron.ipcMain.handle("studio:project-remove", (_event, projectId) => {
    removeProject(projectId);
    return true;
  });
  electron.ipcMain.handle("studio:project-rename", (_event, projectId, name) => {
    const project = listProjects().find((p) => p.id === projectId);
    if (!project) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const manifest = readManifest(project.rootPath);
    if (manifest) {
      writeManifest(project.rootPath, { ...manifest, name: trimmed });
    }
    return upsertProject({ name: trimmed, rootPath: project.rootPath });
  });
  electron.ipcMain.handle("studio:project-create", async (_event, name) => {
    const win = getWindow2();
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      title: "Select folder for new project",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const parent = result.filePaths[0];
    await rememberDialogPath(parent);
    const folderName = slugifyProjectName(name);
    const root = node_path.join(parent, folderName);
    const manifest = createProjectTemplate(root, name.trim() || folderName);
    const project = upsertProject({ name: manifest.name, rootPath: root });
    return { project, root };
  });
  electron.ipcMain.handle(
    "studio:project-create-from-template",
    async (_event, name, templateId) => {
      const win = getWindow2();
      const result = await electron.dialog.showOpenDialog(win ?? void 0, {
        title: "Select folder for new project",
        properties: ["openDirectory", "createDirectory"]
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      const parent = result.filePaths[0];
      await rememberDialogPath(parent);
      const folderName = slugifyProjectName(name);
      const root = node_path.join(parent, folderName);
      const manifest = createProjectFromTemplate(root, name.trim() || folderName, templateId);
      const project = upsertProject({ name: manifest.name, rootPath: root });
      return { project, root };
    }
  );
  electron.ipcMain.handle("studio:project-open-folder", async () => {
    const win = getWindow2();
    const result = await electron.dialog.showOpenDialog(win ?? void 0, {
      title: "Open project folder",
      properties: ["openDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const root = result.filePaths[0];
    await rememberDialogPath(root);
    if (!node_fs.existsSync(root)) return null;
    const manifest = await loadOrCreateManifest(root);
    const project = upsertProject({ name: manifest.name, rootPath: root });
    return { project, root };
  });
  electron.ipcMain.handle("studio:project-touch", (_event, projectId) => {
    touchProject(projectId);
    return true;
  });
  electron.ipcMain.handle(
    "studio:project-cache-modules",
    (_event, projectId, modules) => {
      replaceProjectModules(projectId, modules);
      return true;
    }
  );
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
}
electron.app.whenReady().then(async () => {
  registerFileHandlers(getWindow);
  registerWindowHandlers(getWindow);
  registerProjectHandlers(getWindow);
  try {
    await initProjectIndex();
  } catch (err) {
    console.error("[studio] Failed to open project index:", err);
  }
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
