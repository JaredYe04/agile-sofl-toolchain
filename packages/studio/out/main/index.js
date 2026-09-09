"use strict";
const electron = require("electron");
const node_fs = require("node:fs");
const node_path = require("node:path");
const promises = require("node:fs/promises");
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
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}
function applyEnvFile(filePath) {
  if (!node_fs.existsSync(filePath)) return;
  const parsed = parseEnv(node_fs.readFileSync(filePath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || process.env[key] === "") process.env[key] = value;
  }
}
function loadStudioEnv() {
  const files = [
    node_path.join(process.cwd(), ".env"),
    node_path.join(electron.app.getAppPath(), ".env"),
    node_path.join(electron.app.getAppPath(), "../.env"),
    node_path.join(electron.app.getAppPath(), "../../.env")
  ];
  try {
    files.unshift(node_path.join(electron.app.getAppPath(), "packages/studio/.env"));
  } catch {
  }
  for (const file of files) applyEnvFile(file);
}
function getEnvLlmFallback() {
  loadStudioEnv();
  return {
    apiKey: process.env.ECNU_API_KEY?.trim() || "",
    baseUrl: (process.env.ECNU_API_BASE_URL || "https://chat.ecnu.edu.cn/open/api/v1").replace(/\/$/, ""),
    model: process.env.ECNU_MODEL || "ecnu-max"
  };
}
function newProfileId() {
  return `llm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function normalizeBaseUrl(url) {
  return url.trim().replace(/\/+$/, "");
}
function maskApiKey(key) {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
function toPublicProfile(profile, activeId) {
  return {
    id: profile.id,
    name: profile.name,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKeyMasked: maskApiKey(profile.apiKey),
    hasKey: Boolean(profile.apiKey.trim()),
    active: profile.id === activeId
  };
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function parseProfile(raw, fallbackId) {
  const object = asRecord(raw);
  if (!object) return null;
  const baseUrl = typeof object.baseUrl === "string" ? normalizeBaseUrl(object.baseUrl) : "";
  const apiKey = typeof object.apiKey === "string" ? object.apiKey : "";
  const model = typeof object.model === "string" ? object.model.trim() : "";
  const nameRaw = typeof object.name === "string" ? object.name.trim() : "";
  if (!baseUrl && !model && !apiKey && !nameRaw) return null;
  const id = typeof object.id === "string" && object.id.trim() ? object.id.trim() : fallbackId;
  return {
    id,
    name: nameRaw || model || "LLM",
    baseUrl,
    apiKey,
    model
  };
}
function parseLlmImport(raw) {
  let value = raw;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Empty JSON");
    value = JSON.parse(trimmed);
  }
  if (Array.isArray(value)) {
    const profiles = value.map((item) => parseProfile(item, newProfileId())).filter((item) => Boolean(item)).map((item) => ({ ...item, id: newProfileId() }));
    if (!profiles.length) throw new Error("No LLM profiles in JSON array");
    return { mode: "append", profiles };
  }
  const object = asRecord(value);
  if (object && Array.isArray(object.profiles)) {
    const profiles = object.profiles.map((item, index) => parseProfile(item, `llm-import-${index}`)).filter((item) => Boolean(item));
    if (!profiles.length) throw new Error("No LLM profiles in dump");
    const seen = /* @__PURE__ */ new Set();
    for (const profile of profiles) {
      if (seen.has(profile.id)) profile.id = newProfileId();
      seen.add(profile.id);
    }
    const activeId = typeof object.activeId === "string" || object.activeId === null ? object.activeId : void 0;
    return { mode: "replace", profiles, activeId };
  }
  const one = parseProfile(value, newProfileId());
  if (one) return { mode: "append", profiles: [{ ...one, id: newProfileId() }] };
  throw new Error("Invalid LLM profile JSON");
}
function dumpLlmProfiles(store) {
  return JSON.stringify({ activeId: store.activeId, profiles: store.profiles }, null, 2);
}
function resolveActiveProfile(store) {
  if (store.activeId) {
    const active = store.profiles.find((p) => p.id === store.activeId);
    if (active) return active;
  }
  return store.profiles.find((p) => p.apiKey.trim()) ?? store.profiles[0] ?? null;
}
const TEST_TIMEOUT_MS = 15e3;
function storePath() {
  return node_path.join(electron.app.getPath("userData"), "llm-profiles.json");
}
function envFallback() {
  const env = getEnvLlmFallback();
  return {
    id: "env-default",
    name: "ChatECNU",
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    model: env.model
  };
}
function emptyStore() {
  return { activeId: null, profiles: [] };
}
function readStore() {
  const file = storePath();
  if (!node_fs.existsSync(file)) {
    const seeded = envFallback();
    if (!seeded.apiKey && !seeded.baseUrl) return emptyStore();
    const next = { activeId: seeded.apiKey ? seeded.id : null, profiles: [seeded] };
    writeStore(next);
    return next;
  }
  try {
    const parsed = JSON.parse(node_fs.readFileSync(file, "utf8"));
    if (!parsed || !Array.isArray(parsed.profiles)) return emptyStore();
    return {
      activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
      profiles: parsed.profiles.filter((p) => p && typeof p.id === "string")
    };
  } catch {
    return emptyStore();
  }
}
function writeStore(store) {
  const file = storePath();
  node_fs.mkdirSync(node_path.dirname(file), { recursive: true });
  node_fs.writeFileSync(file, dumpLlmProfiles(store), "utf8");
}
function listLlmProfiles() {
  const store = readStore();
  return {
    activeId: store.activeId,
    profiles: store.profiles.map((p) => toPublicProfile(p, store.activeId))
  };
}
function getActiveLlmConfig() {
  const active = resolveActiveProfile(readStore());
  if (!active?.apiKey.trim()) return null;
  return {
    apiKey: active.apiKey.trim(),
    baseUrl: normalizeBaseUrl(active.baseUrl) || envFallback().baseUrl,
    model: active.model.trim() || "ecnu-max"
  };
}
function getEcnuConfig() {
  return getActiveLlmConfig() ?? getEnvLlmFallback();
}
function saveLlmProfile(draft) {
  const store = readStore();
  const existing = draft.id ? store.profiles.find((p) => p.id === draft.id) : void 0;
  const id = existing?.id ?? newProfileId();
  const next = {
    id,
    name: (draft.name ?? existing?.name ?? "").trim() || (draft.model ?? existing?.model ?? "LLM"),
    baseUrl: normalizeBaseUrl(draft.baseUrl ?? existing?.baseUrl ?? ""),
    apiKey: draft.apiKey != null && draft.apiKey !== "" ? draft.apiKey : existing?.apiKey ?? "",
    model: (draft.model ?? existing?.model ?? "").trim()
  };
  if (existing) {
    store.profiles = store.profiles.map((p) => p.id === id ? next : p);
  } else {
    store.profiles = [...store.profiles, next];
  }
  if (draft.activate || !store.activeId) store.activeId = id;
  writeStore(store);
  return { ...listLlmProfiles(), savedId: id };
}
function deleteLlmProfile(id) {
  const store = readStore();
  store.profiles = store.profiles.filter((p) => p.id !== id);
  if (store.activeId === id) store.activeId = store.profiles[0]?.id ?? null;
  writeStore(store);
  return listLlmProfiles();
}
function setActiveLlmProfile(id) {
  const store = readStore();
  if (!store.profiles.some((p) => p.id === id)) throw new Error("Unknown LLM profile");
  store.activeId = id;
  writeStore(store);
  return listLlmProfiles();
}
function exportLlmProfiles() {
  return dumpLlmProfiles(readStore());
}
function importLlmProfiles(raw) {
  const parsed = parseLlmImport(raw);
  const store = readStore();
  if (parsed.mode === "replace") {
    store.profiles = parsed.profiles;
    store.activeId = parsed.activeId && parsed.profiles.some((p) => p.id === parsed.activeId) ? parsed.activeId : parsed.profiles[0]?.id ?? null;
  } else {
    store.profiles = [...store.profiles, ...parsed.profiles];
    if (!store.activeId && parsed.profiles[0]) store.activeId = parsed.profiles[0].id;
  }
  writeStore(store);
  return listLlmProfiles();
}
function resolveTestConfig(request) {
  const store = readStore();
  const existing = request.profileId ? store.profiles.find((p) => p.id === request.profileId) : void 0;
  const apiKey = request.draft?.apiKey && request.draft.apiKey.trim() ? request.draft.apiKey.trim() : existing?.apiKey.trim() ?? "";
  const baseUrl = normalizeBaseUrl(request.draft?.baseUrl || existing?.baseUrl || "");
  const model = (request.draft?.model || existing?.model || "").trim();
  return { apiKey, baseUrl, model };
}
async function pingModels(cfg) {
  const started = Date.now();
  const res = await fetch(`${cfg.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(TEST_TIMEOUT_MS)
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}`, ms, detail: text.slice(0, 240) };
  }
  let count;
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json.data)) count = json.data.length;
  } catch {
  }
  return {
    ok: true,
    message: count != null ? `OK · ${count} models` : `OK · HTTP ${res.status}`,
    ms
  };
}
async function pingChat(cfg) {
  const started = Date.now();
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: "Reply with the single word pong." }],
      max_tokens: 8,
      temperature: 0,
      stream: false,
      thinking: { type: "disabled" }
    }),
    signal: AbortSignal.timeout(TEST_TIMEOUT_MS)
  });
  const ms = Date.now() - started;
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}`, ms, detail: text.slice(0, 240) };
  }
  let snippet = text.slice(0, 160);
  try {
    const json = JSON.parse(text);
    snippet = json.choices?.[0]?.message?.content?.trim() || snippet;
  } catch {
  }
  return { ok: true, message: `OK · ${ms}ms`, ms, detail: snippet };
}
async function testLlmProfile(request) {
  const cfg = resolveTestConfig(request);
  if (!cfg.baseUrl) return { ok: false, message: "Missing base URL", ms: 0 };
  if (!cfg.apiKey) return { ok: false, message: "Missing API key", ms: 0 };
  if (request.kind === "params" && !cfg.model) return { ok: false, message: "Missing model name", ms: 0 };
  try {
    if (request.kind === "params") return await pingChat(cfg);
    try {
      const models = await pingModels(cfg);
      if (models.ok) return models;
      if (models.message.includes("HTTP 404") || models.message.includes("HTTP 405")) {
        if (!cfg.model) return models;
        return await pingChat(cfg);
      }
      return models;
    } catch {
      if (!cfg.model) throw new Error("Connectivity test failed");
      return await pingChat(cfg);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message, ms: 0 };
  }
}
const CHAT_TIMEOUT_MS = 9e4;
async function postChat(body) {
  const cfg = getEcnuConfig();
  if (!cfg.apiKey) {
    throw new Error("No LLM API key. Add a profile in Settings, or set ECNU_API_KEY in packages/studio/.env.");
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({ model: cfg.model, ...body }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS)
  }).catch((e) => {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error("ChatECNU timed out after 90s. Send again to continue.");
    }
    throw e;
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ChatECNU ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}
async function chatEcnuStream(options) {
  const body = {
    messages: options.messages,
    temperature: options.temperature ?? 0.35,
    stream: true,
    thinking: { type: options.thinking === false ? "disabled" : "enabled" }
  };
  if (options.thinking !== false) body.reasoning_effort = "low";
  if (options.tools?.length) body.tools = options.tools;
  const res = await postChat(body);
  if (!res.body) throw new Error("ChatECNU stream has no body.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  const tools = [];
  let finishReason = "stop";
  const flushLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    const choice = parsed.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta;
    if (!delta) return;
    const reasonChunk = delta.reasoning_content ?? delta.reasoning ?? "";
    const contentChunk = delta.content ?? "";
    if (reasonChunk) {
      reasoning += reasonChunk;
      options.onDelta?.({ reasoning });
    }
    if (contentChunk) {
      content += contentChunk;
      options.onDelta?.({ content });
    }
    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? tools.length;
      const current = tools[index] ?? { id: "", name: "", arguments: "" };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name += call.function.name;
      if (call.function?.arguments) current.arguments += call.function.arguments;
      tools[index] = current;
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) flushLine(line);
  }
  if (buffer.trim()) flushLine(buffer);
  return {
    content,
    reasoning,
    toolCalls: tools.filter((t) => t.name).map((t) => ({
      id: t.id || `call-${t.name}`,
      type: "function",
      function: { name: t.name, arguments: t.arguments || "{}" }
    })),
    finishReason
  };
}
function hasEcnuKey() {
  return Boolean(getEcnuConfig().apiKey);
}
const AGENT_SKILLS = [
  {
    id: "requirement-discovery",
    name: "Requirement Discovery",
    prompt: "Discover Functions, Data Resources, and Constraints from the user's natural language. Do not dump a full specification. Summarize candidates, then ask clarifying questions, then propose a structured patch."
  },
  {
    id: "requirement-clarification",
    name: "Requirement Clarification",
    prompt: "Find vague, missing, or ambiguous information. Ask focused questions (options + optional custom input). Do not invent details the user did not confirm."
  },
  {
    id: "function-decomposition",
    name: "Function Decomposition",
    prompt: "Decompose a selected function into sub-steps. Propose child function nodes, not free-form markdown."
  },
  {
    id: "data-modeling",
    name: "Data Modeling",
    prompt: "Identify data resources and fields. Propose data-resource / data-field nodes with clear titles and short descriptions."
  },
  {
    id: "constraint-discovery",
    name: "Constraint Discovery",
    prompt: "Turn business rules into Constraint nodes with precise natural-language statements (limits, locking, non-negativity, uniqueness)."
  },
  {
    id: "specification-review",
    name: "Specification Review",
    prompt: "Review Completeness, Precision, Consistency, and Traceability. Call review_specification and list concrete issues tied to node ids when possible."
  }
];
function skillById(id) {
  return AGENT_SKILLS.find((s) => s.id === id) ?? AGENT_SKILLS[0];
}
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description: "Ask the user a structured clarification question. The UI will render options the user can click, plus optional custom input. Use this instead of listing questions only in prose when a decision is needed.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { id: { type: "string" }, label: { type: "string" } },
              required: ["id", "label"]
            }
          },
          allowCustom: { type: "boolean" },
          multiSelect: { type: "boolean" }
        },
        required: ["question"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_changes",
      description: "Propose a structured Informal Specification patch against the CURRENT spec (see inventory ids). Never write raw markdown. The editor shows a preview for Apply / Reject. You MAY add new nodes, AND update or remove existing ones. Prefer update/remove on existing ids over adding duplicates.",
      parameters: {
        type: "object",
        properties: {
          explanation: { type: "string" },
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["add", "update", "remove", "move"] },
                target: {
                  type: "string",
                  description: "add only: functions | data-resources | constraints, or a parent node id (for nested fields)."
                },
                id: {
                  type: "string",
                  description: "update / remove / move: existing node id from the inventory (or unique title)."
                },
                parentId: { type: "string" },
                afterId: { type: "string" },
                title: { type: "string", description: "update: new title" },
                description: { type: "string", description: "update: new body text" },
                node: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["function", "data-resource", "data-field", "constraint", "text"]
                    },
                    title: { type: "string" },
                    description: { type: "string" }
                  }
                }
              },
              required: ["op"]
            }
          }
        },
        required: ["operations"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_specification",
      description: "Return the current Informal Specification inventory: every node id, type, title, and description. Call this before propose_changes when you need to edit or delete existing items.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "review_specification",
      description: "Record a structured review of the current informal specification.",
      parameters: {
        type: "object",
        properties: {
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dimension: {
                  type: "string",
                  enum: ["completeness", "precision", "consistency", "traceability"]
                },
                message: { type: "string" },
                nodeId: { type: "string" }
              },
              required: ["dimension", "message"]
            }
          }
        },
        required: ["issues"]
      }
    }
  }
];
function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function clone$1(value) {
  return JSON.parse(JSON.stringify(value));
}
function toolIdsFor(message) {
  const ids = /* @__PURE__ */ new Set();
  for (const call of message.toolCalls ?? []) ids.add(call.id);
  if (message.clarification?.pendingToolCallId) ids.add(message.clarification.pendingToolCallId);
  return ids;
}
function pendingToolCallIdOf(message) {
  if (!message.pending) return void 0;
  return message.clarification?.pendingToolCallId ?? message.toolCalls?.[0]?.id;
}
function lastPendingToolCallId(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const id = pendingToolCallIdOf(messages[i]);
    if (id) return id;
  }
  return void 0;
}
function endIndexThrough(messages, idx, mode) {
  if (mode === "reset") return idx;
  const toolIds = toolIdsFor(messages[idx]);
  let end = idx;
  let i = idx + 1;
  while (i < messages.length && messages[i].role === "tool" && toolIds.has(messages[i].id)) {
    end = i;
    i += 1;
  }
  return end;
}
function sliceSessionMessages(messages, throughMessageId, mode) {
  const idx = messages.findIndex((m) => m.id === throughMessageId);
  if (idx < 0) return null;
  const sliced = clone$1(messages.slice(0, endIndexThrough(messages, idx, mode) + 1));
  if (mode === "reset") {
    const msg = sliced[Math.min(idx, sliced.length - 1)];
    msg.pending = true;
    msg.resolution = void 0;
    if (msg.clarification) {
      msg.clarification = { ...msg.clarification, answer: void 0 };
    }
    return {
      messages: sliced,
      pendingToolCallId: msg.clarification?.pendingToolCallId ?? msg.toolCalls?.[0]?.id
    };
  }
  return { messages: sliced, pendingToolCallId: lastPendingToolCallId(sliced) };
}
function applySessionSlice(session, throughMessageId, mode) {
  const sliced = sliceSessionMessages(session.messages, throughMessageId, mode);
  if (!sliced) return null;
  return {
    ...session,
    messages: sliced.messages,
    context: { ...session.context, pendingToolCallId: sliced.pendingToolCallId }
  };
}
function forkSessionRecord(session, throughMessageId, options) {
  const sliced = applySessionSlice(session, throughMessageId, options?.mode ?? "keep");
  if (!sliced) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const copy = clone$1(sliced);
  copy.id = newId("ses");
  copy.title = options?.title?.trim() || `${session.title}`;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.pinned = false;
  copy.archived = false;
  return copy;
}
function sessionsDir(projectRoot) {
  return node_path.join(projectRoot, ".agile-sofl", "agent", "sessions");
}
function ensureDir(dir) {
  node_fs.mkdirSync(dir, { recursive: true });
}
function listSessions(projectRoot) {
  const dir = sessionsDir(projectRoot);
  if (!node_fs.existsSync(dir)) return [];
  return node_fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
    try {
      return JSON.parse(node_fs.readFileSync(node_path.join(dir, f), "utf8"));
    } catch {
      return null;
    }
  }).filter((s) => Boolean(s)).sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (Boolean(a.archived) !== Boolean(b.archived)) return a.archived ? 1 : -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
function loadSession(projectRoot, id) {
  const file = node_path.join(sessionsDir(projectRoot), `${id}.json`);
  if (!node_fs.existsSync(file)) return null;
  try {
    return JSON.parse(node_fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}
function saveSession(projectRoot, session) {
  const dir = sessionsDir(projectRoot);
  ensureDir(dir);
  session.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  node_fs.writeFileSync(node_path.join(dir, `${session.id}.json`), JSON.stringify(session, null, 2), "utf8");
}
function deleteSession(projectRoot, id) {
  const file = node_path.join(sessionsDir(projectRoot), `${id}.json`);
  if (!node_fs.existsSync(file)) return false;
  node_fs.unlinkSync(file);
  return true;
}
function createSession(projectRoot, moduleId, title) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const session = {
    id: newId("ses"),
    moduleId,
    title: title || "Requirement Analysis",
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: { skillId: "requirement-discovery" }
  };
  saveSession(projectRoot, session);
  return session;
}
function renameSession(projectRoot, id, title) {
  const session = loadSession(projectRoot, id);
  if (!session) return null;
  session.title = title.trim() || session.title;
  saveSession(projectRoot, session);
  return session;
}
function duplicateSession(projectRoot, id) {
  const session = loadSession(projectRoot, id);
  if (!session) return null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const copy = {
    ...session,
    id: newId("ses"),
    title: `${session.title} copy`,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    archived: false
  };
  saveSession(projectRoot, copy);
  return copy;
}
function forkSession(projectRoot, id, throughMessageId, options) {
  const session = loadSession(projectRoot, id);
  if (!session) return null;
  const copy = forkSessionRecord(session, throughMessageId, options);
  if (!copy) return null;
  saveSession(projectRoot, copy);
  return copy;
}
function rewindSession(projectRoot, id, throughMessageId, options) {
  const session = loadSession(projectRoot, id);
  if (!session) return null;
  const next = applySessionSlice(session, throughMessageId, options?.mode ?? "reset");
  if (!next) return null;
  saveSession(projectRoot, next);
  return next;
}
function setSessionFlag(projectRoot, id, flag, value) {
  const session = loadSession(projectRoot, id);
  if (!session) return null;
  session[flag] = value;
  saveSession(projectRoot, session);
  return session;
}
const DiagnosticCodes = {
  INFORMAL_UNKNOWN_SECTION: "ASPEC_MD_001",
  INFORMAL_ORPHAN_HEADING: "ASPEC_MD_002"
};
function createDiagnostic(code, message, severity, path) {
  return { code, message, severity, path };
}
function extractInformalFrontmatter(source) {
  const trimmed = source.trimStart();
  if (!trimmed.startsWith("---")) {
    return { meta: {}, body: source, hadFrontmatter: false };
  }
  const end = trimmed.indexOf("\n---", 3);
  if (end < 0)
    return { meta: {}, body: source, hadFrontmatter: false };
  const raw = trimmed.slice(4, end).trim();
  const body = trimmed.slice(end + 4).replace(/^(?:\r?\n)+/, "");
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0)
      continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key)
      fields[key] = value;
  }
  const version = fields.version != null ? Number(fields.version) : void 0;
  const meta = {
    id: fields.id,
    moduleId: fields.moduleId,
    version: version != null && Number.isFinite(version) ? version : void 0,
    title: fields.title,
    author: fields.author,
    hybridTarget: fields.hybridTarget,
    guiTarget: fields.guiTarget
  };
  return { meta, body, hadFrontmatter: true };
}
function stripInformalIdComments(markdown) {
  const next = markdown.replace(/[ \t]*<!--\s*@id:[^>]*-->/gi, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  return next ? `${next}
` : "";
}
const PREFIX = {
  function: "fn",
  "data-resource": "dr",
  "data-field": "df",
  constraint: "c",
  text: "tx",
  functions: "sec-fn",
  "data-resources": "sec-dr",
  constraints: "sec-c"
};
function slugify(title) {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || "node";
}
function createNodeId(type, title, used) {
  const prefix = PREFIX[type] ?? "n";
  const base = `${prefix}-${slugify(title)}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}-${i}`))
    i += 1;
  const id = `${base}-${i}`;
  used.add(id);
  return id;
}
function treeToSpec(tree) {
  const sections = tree.sections.map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    children: section.children.map((child) => treeNodeToFlat(child, void 0))
  }));
  relink(sections);
  return {
    id: tree.id,
    moduleId: tree.moduleId,
    version: tree.version,
    metadata: tree.metadata,
    sections
  };
}
function treeNodeToFlat(node, parentId) {
  const children = node.children.map((c) => treeNodeToFlat(c, node.id));
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    description: node.description,
    parentId,
    children: children.map((c) => c.id),
    metadata: {
      ...node.metadata,
      nested: children
    }
  };
}
function relink(sections) {
  for (const section of sections) {
    const walk = (nodes, parentId) => {
      for (const node of nodes) {
        node.parentId = parentId;
        const nested = node.metadata?.nested ?? [];
        node.children = nested.map((c) => c.id);
        walk(nested, node.id);
      }
    };
    walk(section.children, void 0);
  }
}
const DEFAULT_INFORMAL_SECTIONS = [
  {
    id: "functions",
    title: "Functions",
    type: "functions",
    required: true,
    allowChildren: true,
    order: 1,
    childType: "function",
    grandchildType: "function"
  },
  {
    id: "data-resources",
    title: "Data Resources",
    type: "data-resources",
    required: true,
    allowChildren: true,
    order: 2,
    childType: "data-resource",
    grandchildType: "data-field"
  },
  {
    id: "constraints",
    title: "Constraints",
    type: "constraints",
    required: true,
    allowChildren: true,
    order: 3,
    childType: "constraint"
  }
];
const TITLE_ALIASES = {
  functions: "functions",
  function: "functions",
  fn: "functions",
  功能: "functions",
  "data resources": "data-resources",
  "data-resources": "data-resources",
  dataresources: "data-resources",
  data: "data-resources",
  数据: "data-resources",
  "数据资源": "data-resources",
  constraints: "constraints",
  constraint: "constraints",
  约束: "constraints"
};
function sectionTypeFromTitle(title) {
  const cleaned = title.replace(/^#+\s*/, "").trim().toLowerCase();
  return TITLE_ALIASES[cleaned] ?? TITLE_ALIASES[cleaned.replace(/_/g, "-")] ?? null;
}
function sectionDef(type) {
  return DEFAULT_INFORMAL_SECTIONS.find((s) => s.id === type);
}
function nodeTypeForLevel(section, headingLevel) {
  const def = sectionDef(section);
  if (headingLevel <= 2)
    return def.childType;
  return def.grandchildType ?? def.childType;
}
const ID_COMMENT = /<!--\s*@id:([^>]+?)\s*-->/i;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
function splitBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let current = null;
  const bodyLines = [];
  const flush = () => {
    if (!current)
      return;
    const taken = consumeIdFromBody(bodyLines.join("\n"), current.id);
    current.id = taken.id;
    current.body = taken.body;
    blocks.push(current);
    bodyLines.length = 0;
  };
  for (const line of lines) {
    const match = line.match(HEADING);
    if (match) {
      flush();
      const rawTitle = match[2] ?? "";
      const idMatch = rawTitle.match(ID_COMMENT);
      const title = rawTitle.replace(ID_COMMENT, "").trim();
      current = {
        level: match[1].length,
        title,
        id: idMatch?.[1]?.trim(),
        body: ""
      };
      continue;
    }
    if (current)
      bodyLines.push(line);
  }
  flush();
  return blocks;
}
function consumeIdFromBody(body, existingId) {
  const lines = body.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && lines[start].trim() === "")
    start += 1;
  const match = lines[start]?.trim().match(/^<!--\s*@id:([^>]+?)\s*-->$/);
  if (!match)
    return { id: existingId, body: body.trim() };
  const rest = [...lines.slice(0, start), ...lines.slice(start + 1)].join("\n").trim();
  return { id: existingId || match[1]?.trim(), body: rest };
}
function parseInformalSpec(markdown, options) {
  const diagnostics = [];
  const extracted = extractInformalFrontmatter(markdown);
  const body = extracted.body;
  const meta = { ...extracted.meta, ...options?.meta };
  const blocks = splitBlocks(body);
  const used = /* @__PURE__ */ new Set();
  const sections = DEFAULT_INFORMAL_SECTIONS.map((def) => ({
    id: def.id === "functions" ? "sec-fn" : def.id === "data-resources" ? "sec-dr" : "sec-c",
    type: def.id,
    title: def.title,
    children: []
  }));
  const sectionByType = new Map(sections.map((s) => [s.type, s]));
  let activeType = null;
  const stack = [];
  for (const block of blocks) {
    if (block.level === 1) {
      const type2 = sectionTypeFromTitle(block.title);
      if (!type2) {
        diagnostics.push(createDiagnostic(DiagnosticCodes.INFORMAL_UNKNOWN_SECTION, `Top-level heading "# ${block.title}" is not allowed. Use Functions, Data Resources, or Constraints.`, "error", block.title));
        activeType = null;
        stack.length = 0;
        continue;
      }
      activeType = type2;
      stack.length = 0;
      const section = sectionByType.get(type2);
      if (section && block.id)
        section.id = block.id;
      continue;
    }
    if (!activeType) {
      diagnostics.push(createDiagnostic(DiagnosticCodes.INFORMAL_ORPHAN_HEADING, `Heading "${block.title}" appears before a valid top-level section.`, "warning", block.title));
      continue;
    }
    const type = nodeTypeForLevel(activeType, block.level);
    const id = block.id && !used.has(block.id) ? block.id : createNodeId(type, block.title, used);
    used.add(id);
    const node = {
      id,
      type,
      title: block.title,
      description: block.body || void 0,
      children: []
    };
    while (stack.length && stack[stack.length - 1].level >= block.level)
      stack.pop();
    if (stack.length === 0) {
      sectionByType.get(activeType).children.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
      node.parentId = stack[stack.length - 1].node.id;
    }
    stack.push({ level: block.level, node });
  }
  const tree = {
    id: meta.id || "spec-local",
    moduleId: meta.moduleId || "project",
    version: meta.version && Number.isFinite(meta.version) ? meta.version : 1,
    metadata: {
      title: meta.title,
      author: meta.author,
      hybridTarget: meta.hybridTarget,
      guiTarget: meta.guiTarget,
      sourceFormat: "markdown"
    },
    sections
  };
  const specification = treeToSpec(tree);
  for (const def of DEFAULT_INFORMAL_SECTIONS) {
    if (def.required && !specification.sections.some((s) => s.type === def.id)) {
      specification.sections.push({
        id: sectionDef(def.id).id,
        type: def.id,
        title: def.title,
        children: []
      });
    }
  }
  specification.sections.sort((a, b) => sectionDef(a.type).order - sectionDef(b.type).order);
  return {
    specification,
    diagnostics,
    format: "markdown",
    displaySource: stripInformalIdComments(body)
  };
}
function nestedOf(node) {
  return node.metadata?.nested ?? [];
}
function clip(text, n) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= n)
    return compact;
  return `${compact.slice(0, Math.max(0, n - 1))}…`;
}
function formatInformalInventory(spec, maxChars = 12e3) {
  if (!spec)
    return "(empty informal specification)";
  const lines = [];
  for (const section of spec.sections) {
    lines.push(`## ${section.title} [${section.type}]`);
    const walk = (nodes, depth) => {
      if (!nodes.length && depth === 0) {
        lines.push("- (empty)");
        return;
      }
      for (const node of nodes) {
        const desc = node.description?.trim() ? ` — ${clip(node.description, 240)}` : "";
        lines.push(`${"  ".repeat(depth)}- ${node.id} (${node.type}) ${node.title}${desc}`);
        walk(nestedOf(node), depth + 1);
      }
    };
    walk(section.children, 0);
    lines.push("");
  }
  const text = lines.join("\n").trim();
  if (text.length <= maxChars)
    return text;
  return `${text.slice(0, maxChars)}
…(truncated)`;
}
function informalInventoryFromMarkdown(markdown, maxChars = 12e3) {
  const { specification } = parseInformalSpec(markdown);
  return formatInformalInventory(specification, maxChars);
}
const MAX_HISTORY = 20;
function compactSpec(markdown) {
  return informalInventoryFromMarkdown(markdown, 12e3);
}
function systemPrompt(ctx) {
  const skill = skillById(ctx.skillId);
  return `You are the Agile-SOFL Specification Agent inside Studio.
You help users build an Informal Specification with a fixed schema:
# Functions
# Data Resources
# Constraints

Markdown is only a view. You MUST NOT output a full markdown document to apply.
You MUST use tools:
- ask_clarification: when you need a decision (render options the user can click)
- read_specification: when you need ids of existing items before editing
- propose_changes: when ready to add, update, remove, or move nodes (preview + user confirm)
- review_specification: for quality review

Never claim you already modified the file. The editor applies patches only after the user clicks Apply.
After the user applies or rejects a patch, stop and wait for their next message. Do not immediately propose more changes.
After an ask_clarification tool result, you MUST continue: call ask_clarification again or propose_changes. Never return an empty message.

For propose_changes, operate on the CURRENT inventory below (ids like fn-login, dr-account, c-unique):
- add: target = functions | data-resources | constraints (or a parent node id). node.type = function | data-resource | data-field | constraint. Include title and description.
- update: id = existing node id (or unique title). Set title and/or description. Use this to revise existing items.
- remove: id = existing node id. Use this to delete obsolete items.
- move: id + parentId + optional afterId.
Prefer update/remove on existing nodes over adding a second copy of the same idea.
Do not invent YAML frontmatter or document-level metadata.

Active skill: ${skill.name}
${skill.prompt}

Current project: ${ctx.projectName ?? "unknown"}
Current module: ${ctx.moduleId ?? "project"}
Selected node: ${ctx.selectedNodeSummary || ctx.selectedNodeId || "(none — stay focused on selection when present)"}

Current Informal Specification inventory:
${compactSpec(ctx.informalMarkdown)}
`;
}
function toApiMessages(session, ctx, options) {
  const msgs = [{ role: "system", content: systemPrompt(ctx) }];
  const toolResults = /* @__PURE__ */ new Map();
  for (const m of session.messages) {
    if (m.role === "tool") toolResults.set(m.id, m);
  }
  const body = [];
  for (const m of session.messages) {
    if (m.role === "system" || m.role === "tool") continue;
    if (m.role === "user") {
      body.push({ role: "user", content: m.content });
      continue;
    }
    if (m.role !== "assistant") continue;
    const toolCalls = m.toolCalls ?? [];
    if (toolCalls.length) {
      const results = toolCalls.map((call) => toolResults.get(call.id));
      if (results.some((result) => !result)) continue;
      const assistant = {
        role: "assistant",
        content: m.content || null,
        tool_calls: toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.arguments }
        })),
        reasoning_content: m.thinking ?? ""
      };
      body.push(assistant);
      for (const call of toolCalls) {
        body.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResults.get(call.id).content
        });
      }
      continue;
    }
    if (m.content.trim() || m.thinking?.trim()) {
      body.push({ role: "assistant", content: m.content });
    }
  }
  const startIndexes = /* @__PURE__ */ new Set();
  for (let i = 0; i < body.length; i++) {
    const msg = body[i];
    if (msg.role === "assistant" && msg.tool_calls?.length) {
      startIndexes.add(i);
      let j = i + 1;
      while (j < body.length && body[j]?.role === "tool") {
        startIndexes.add(j);
        j += 1;
      }
    }
  }
  for (let i = Math.max(0, body.length - MAX_HISTORY); i < body.length; i++) startIndexes.add(i);
  const trimmed = body.filter((_, i) => startIndexes.has(i));
  msgs.push(...trimmed);
  if (options?.continuation) {
    msgs.push({
      role: "user",
      content: "Continue now. Call ask_clarification for the next decision, or propose_changes if you have enough detail. Do not reply with an empty message."
    });
  }
  return msgs;
}
function parseArgs(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function validatePatch(_source, patch) {
  if (!Array.isArray(patch.operations) || patch.operations.length === 0) {
    return { ok: false, message: "Patch has no operations." };
  }
  return { ok: true, message: "Patch will be schema-validated when applied." };
}
function emit(sink, event) {
  sink?.(event);
}
async function runAgentTurn(session, projectRoot, ctx, userText, sink) {
  if (userText?.trim()) {
    session.messages.push({
      id: newId("msg"),
      role: "user",
      content: userText.trim(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      skillId: ctx.skillId
    });
    if (session.title === "Requirement Analysis" && session.messages.filter((m) => m.role === "user").length === 1) {
      session.title = userText.trim().slice(0, 42);
    }
    saveSession(projectRoot, session);
    emit(sink, { kind: "session", session });
  }
  session.context.skillId = ctx.skillId || session.context.skillId || "requirement-discovery";
  session.context.selectedNodeId = ctx.selectedNodeId;
  const continuation = !userText?.trim();
  for (let step = 0; step < 6; step++) {
    const assistantId = newId("msg");
    const live = {
      id: assistantId,
      role: "assistant",
      content: "",
      thinking: "",
      streaming: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      skillId: ctx.skillId
    };
    session.messages.push(live);
    emit(sink, { kind: "session", session });
    const history = { ...session, messages: session.messages.filter((m) => m.id !== assistantId) };
    const request = {
      messages: toApiMessages(history, ctx, { continuation: continuation && step === 0 }),
      tools: AGENT_TOOLS,
      temperature: 0.35
    };
    let completion;
    try {
      completion = await chatEcnuStream({
        ...request,
        thinking: true,
        onDelta: (delta) => {
          if (delta.reasoning != null) {
            live.thinking = delta.reasoning;
            emit(sink, { kind: "reasoning", messageId: assistantId, text: delta.reasoning });
          }
          if (delta.content != null) {
            live.content = delta.content;
            emit(sink, { kind: "content", messageId: assistantId, text: delta.content });
          }
        }
      });
    } catch {
      try {
        completion = await chatEcnuStream({
          ...request,
          thinking: false,
          onDelta: (delta) => {
            if (delta.content != null) {
              live.content = delta.content;
              emit(sink, { kind: "content", messageId: assistantId, text: delta.content });
            }
          }
        });
      } catch (err) {
        live.streaming = false;
        live.content = err instanceof Error ? err.message : String(err);
        saveSession(projectRoot, session);
        emit(sink, { kind: "session", session });
        throw err;
      }
    }
    live.streaming = false;
    live.content = completion.content.trim();
    live.thinking = completion.reasoning.trim() || live.thinking;
    if (completion.toolCalls.length) {
      live.toolCalls = completion.toolCalls.map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments
      }));
    }
    if (completion.toolCalls.length) {
      for (const call of completion.toolCalls) {
        const args = parseArgs(call.function.arguments || "{}");
        if (call.function.name === "ask_clarification") {
          const options = Array.isArray(args.options) ? args.options.filter((o) => o.label).map((o, i) => ({ id: o.id || `opt-${i}`, label: String(o.label) })) : void 0;
          live.content = String(args.question || live.content || "");
          live.clarification = {
            id: newId("q"),
            question: String(args.question || "Please clarify."),
            options,
            allowCustom: args.allowCustom !== false,
            multiSelect: Boolean(args.multiSelect),
            pendingToolCallId: call.id
          };
          live.pending = true;
          session.context.pendingToolCallId = call.id;
          completeSiblingToolCalls(session, completion.toolCalls, call.id);
          saveSession(projectRoot, session);
          emit(sink, { kind: "session", session });
          return session;
        }
        if (call.function.name === "propose_changes") {
          const patch = {
            explanation: typeof args.explanation === "string" ? args.explanation : void 0,
            operations: Array.isArray(args.operations) ? args.operations : []
          };
          const validity = validatePatch(ctx.informalMarkdown, patch);
          live.content = patch.explanation || live.content || (validity.ok ? "Proposed specification changes." : `Patch failed validation: ${validity.message}`);
          live.proposedChanges = validity.ok ? patch : void 0;
          live.pending = true;
          session.context.pendingToolCallId = call.id;
          completeSiblingToolCalls(session, completion.toolCalls, call.id);
          saveSession(projectRoot, session);
          emit(sink, { kind: "session", session });
          return session;
        }
        if (call.function.name === "read_specification") {
          const inventory = informalInventoryFromMarkdown(ctx.informalMarkdown);
          session.messages.push({
            id: call.id,
            role: "tool",
            content: JSON.stringify({ ok: true, inventory }),
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          live.content = live.content || "Read the current Informal Specification inventory.";
          continue;
        }
        if (call.function.name === "review_specification") {
          const typedIssues = Array.isArray(args.issues) ? args.issues.map((i) => ({
            dimension: String(i.dimension || "completeness"),
            message: String(i.message || ""),
            nodeId: i.nodeId
          })) : [];
          live.content = live.content || "Specification review";
          live.review = { issues: typedIssues };
          session.messages.push({
            id: call.id,
            role: "tool",
            content: JSON.stringify({ ok: true, issues: typedIssues }),
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          continue;
        }
        session.messages.push({
          id: call.id,
          role: "tool",
          content: JSON.stringify({ ok: false, error: `Unknown tool ${call.function.name}` }),
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      saveSession(projectRoot, session);
      emit(sink, { kind: "session", session });
      continue;
    }
    if (!live.content && !live.thinking) {
      if (continuation && step === 0) {
        live.content = "已收到你的回答。请直接发下一条消息，告诉我继续补充需求，或让我把已确认的内容写入规格。";
      } else {
        session.messages = session.messages.filter((m) => m.id !== assistantId);
      }
    }
    break;
  }
  saveSession(projectRoot, session);
  emit(sink, { kind: "session", session });
  return session;
}
function completeSiblingToolCalls(session, calls, keepId) {
  for (const call of calls) {
    if (call.id === keepId) continue;
    if (session.messages.some((m) => m.role === "tool" && m.id === call.id)) continue;
    session.messages.push({
      id: call.id,
      role: "tool",
      content: JSON.stringify({ skipped: true, reason: "Paused for a user decision on another tool." }),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
}
function parseResumePayload(result) {
  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}
async function resumeWithToolResult(session, projectRoot, ctx, toolCallId, result, sink, continueTurn = true) {
  const payload = parseResumePayload(result);
  for (const m of session.messages) {
    if (!m.pending) continue;
    if (m.clarification?.pendingToolCallId === toolCallId || session.context.pendingToolCallId === toolCallId) {
      m.pending = false;
      if (m.clarification) {
        m.clarification.answer = result;
        m.resolution = "answered";
      }
      if (m.proposedChanges) {
        m.resolution = payload.action === "applied" ? "applied" : "rejected";
      }
    }
  }
  session.messages.push({
    id: toolCallId,
    role: "tool",
    content: payload.action ? result : JSON.stringify({
      type: "clarification_answer",
      answer: result,
      next: "Continue with ask_clarification or propose_changes. Do not stop with an empty message."
    }),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  session.context.pendingToolCallId = void 0;
  saveSession(projectRoot, session);
  emit(sink, { kind: "session", session });
  if (!continueTurn) return session;
  return runAgentTurn(session, projectRoot, ctx, void 0, sink);
}
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
function emitDelta(event, payload) {
  event.sender.send("studio:agent-delta", clone(payload));
}
function registerAgentHandlers() {
  loadStudioEnv();
  electron.ipcMain.handle("studio:llm-status", () => {
    const cfg = getEcnuConfig();
    return {
      configured: hasEcnuKey(),
      model: cfg.model,
      baseUrl: cfg.baseUrl
    };
  });
  electron.ipcMain.handle("studio:llm-list-profiles", () => clone(listLlmProfiles()));
  electron.ipcMain.handle(
    "studio:llm-save-profile",
    (_e, draft) => clone(saveLlmProfile(draft ?? {}))
  );
  electron.ipcMain.handle("studio:llm-delete-profile", (_e, id) => clone(deleteLlmProfile(String(id))));
  electron.ipcMain.handle(
    "studio:llm-set-active-profile",
    (_e, id) => clone(setActiveLlmProfile(String(id)))
  );
  electron.ipcMain.handle("studio:llm-export-profiles", () => exportLlmProfiles());
  electron.ipcMain.handle("studio:llm-import-profiles", (_e, raw) => clone(importLlmProfiles(raw)));
  electron.ipcMain.handle("studio:llm-test-profile", (_e, request) => testLlmProfile(request));
  electron.ipcMain.handle(
    "studio:agent-skills",
    () => AGENT_SKILLS.map((s) => ({ id: s.id, name: s.name }))
  );
  electron.ipcMain.handle(
    "studio:agent-list-sessions",
    (_e, projectRoot) => clone(listSessions(projectRoot))
  );
  electron.ipcMain.handle(
    "studio:agent-create-session",
    (_e, payload) => clone(createSession(payload.projectRoot, payload.moduleId || "project", payload.title))
  );
  electron.ipcMain.handle(
    "studio:agent-rename-session",
    (_e, payload) => clone(renameSession(payload.projectRoot, payload.id, payload.title))
  );
  electron.ipcMain.handle(
    "studio:agent-duplicate-session",
    (_e, payload) => clone(duplicateSession(payload.projectRoot, payload.id))
  );
  electron.ipcMain.handle(
    "studio:agent-fork-session",
    (_e, payload) => clone(
      forkSession(payload.projectRoot, payload.id, payload.throughMessageId, {
        mode: payload.mode,
        title: payload.title
      })
    )
  );
  electron.ipcMain.handle(
    "studio:agent-rewind-session",
    (_e, payload) => clone(
      rewindSession(payload.projectRoot, payload.id, payload.throughMessageId, {
        mode: payload.mode
      })
    )
  );
  electron.ipcMain.handle(
    "studio:agent-flag-session",
    (_e, payload) => clone(setSessionFlag(payload.projectRoot, payload.id, payload.flag, payload.value))
  );
  electron.ipcMain.handle(
    "studio:agent-delete-session",
    (_e, payload) => deleteSession(payload.projectRoot, payload.id)
  );
  electron.ipcMain.handle(
    "studio:agent-load-session",
    (_e, payload) => clone(loadSession(payload.projectRoot, payload.id))
  );
  electron.ipcMain.handle(
    "studio:agent-chat",
    async (event, payload) => {
      let session = loadSession(payload.projectRoot, payload.sessionId);
      if (!session) session = createSession(payload.projectRoot, payload.context.moduleId || "project");
      const next = await runAgentTurn(session, payload.projectRoot, payload.context, payload.text, (delta) => {
        emitDelta(event, { sessionId: session.id, ...delta });
      });
      return clone(next);
    }
  );
  electron.ipcMain.handle(
    "studio:agent-resume",
    async (event, payload) => {
      const session = loadSession(payload.projectRoot, payload.sessionId);
      if (!session) return null;
      const next = await resumeWithToolResult(
        session,
        payload.projectRoot,
        payload.context,
        payload.toolCallId,
        payload.result,
        (delta) => emitDelta(event, { sessionId: session.id, ...delta }),
        payload.continueTurn === true
      );
      return clone(next);
    }
  );
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
function informalMetaPath(projectRoot) {
  return node_path.join(projectRoot, ".agile-sofl", "informal-meta.json");
}
function readInformalMeta(projectRoot) {
  const file = informalMetaPath(projectRoot);
  if (!node_fs.existsSync(file)) return null;
  try {
    return JSON.parse(node_fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}
function writeInformalMeta(projectRoot, meta) {
  const file = informalMetaPath(projectRoot);
  node_fs.mkdirSync(node_path.dirname(file), { recursive: true });
  node_fs.writeFileSync(file, `${JSON.stringify(meta, null, 2)}
`, "utf-8");
}
function extractYamlFrontmatter(source) {
  const trimmed = source.trimStart();
  if (!trimmed.startsWith("---")) return { meta: {}, body: source, hadFrontmatter: false };
  const end = trimmed.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: source, hadFrontmatter: false };
  const raw = trimmed.slice(4, end).trim();
  const body = trimmed.slice(end + 4).replace(/^(?:\r?\n)+/, "");
  const fields = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key) fields[key] = value;
  }
  const version = fields.version != null ? Number(fields.version) : void 0;
  return {
    hadFrontmatter: true,
    body,
    meta: {
      id: fields.id,
      moduleId: fields.moduleId,
      version: version != null && Number.isFinite(version) ? version : void 0,
      title: fields.title,
      author: fields.author,
      hybridTarget: fields.hybridTarget,
      guiTarget: fields.guiTarget
    }
  };
}
function inferModuleIdFromAsfl(asfl) {
  if (!asfl) return void 0;
  const match = asfl.match(/\bmodule\s+SYSTEM_([A-Za-z0-9_]+)/);
  return match?.[1];
}
function mergeInformalSidecar(...parts) {
  const merged = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.id) merged.id = part.id;
    if (part.moduleId) merged.moduleId = part.moduleId;
    if (part.version != null) merged.version = part.version;
    if (part.title) merged.title = part.title;
    if (part.author) merged.author = part.author;
    if (part.hybridTarget) merged.hybridTarget = part.hybridTarget;
    if (part.guiTarget) merged.guiTarget = part.guiTarget;
  }
  return merged;
}
function writeInformalSpecFile(projectRoot, relativePath, markdown, extra) {
  const extracted = extractYamlFrontmatter(markdown);
  const existing = readInformalMeta(projectRoot);
  const meta = mergeInformalSidecar(
    { id: node_crypto.randomUUID(), version: 1, moduleId: "project" },
    extracted.meta,
    existing,
    extra
  );
  if (!meta.id) meta.id = node_crypto.randomUUID();
  node_fs.writeFileSync(node_path.join(projectRoot, relativePath), extracted.body.endsWith("\n") ? extracted.body : `${extracted.body}
`, "utf-8");
  writeInformalMeta(projectRoot, meta);
  return meta;
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
  writeInformalSpecFile(
    root,
    informal,
    `# Functions

# Data Resources

# Constraints
`,
    {
      moduleId: ident,
      title: name,
      hybridTarget: `./${hybrid}`,
      guiTarget: `./${gui}`
    }
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
function rewriteCrossRefs(content, entry, _projectName) {
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
  return out;
}
function writeProjectInformal(root, markdown, projectName, hybridContent, hasGui) {
  writeInformalSpecFile(root, STANDARD_INFORMAL, markdown, {
    title: projectName,
    moduleId: inferModuleIdFromAsfl(hybridContent) ?? asflIdent(projectName),
    hybridTarget: `./${STANDARD_HYBRID}`,
    guiTarget: hasGui ? `./${STANDARD_GUI}` : void 0
  });
}
function writeStubInformal(root, projectName, hybridContent) {
  writeProjectInformal(
    root,
    `# Functions

# Data Resources

# Constraints
`,
    projectName,
    hybridContent,
    true
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
      writeProjectInformal(
        root,
        rewriteCrossRefs(readTemplateFile(dir, entry.informal), entry),
        name,
        hybridContent,
        Boolean(entry.gui)
      );
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
      writeProjectInformal(
        root,
        rewriteCrossRefs(readTemplateFile(dir, entry.informal), entry),
        name,
        firstContent,
        Boolean(entry.gui)
      );
    } else {
      writeStubInformal(root, name, firstContent);
    }
  }
  let guiPath;
  if (entry.gui) {
    const guiContent = rewriteCrossRefs(readTemplateFile(dir, entry.gui), entry);
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
function resolveAppIcon() {
  const candidates = [
    node_path.join(__dirname, "../../build/icon.png"),
    node_path.join(__dirname, "../../build/icons/256x256.png")
  ];
  return candidates.find((p) => node_fs.existsSync(p));
}
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
    icon: resolveAppIcon(),
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
  loadStudioEnv();
  registerFileHandlers(getWindow);
  registerWindowHandlers(getWindow);
  registerProjectHandlers(getWindow);
  registerAgentHandlers();
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
