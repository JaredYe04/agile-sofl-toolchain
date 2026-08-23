import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { createRequire } from 'node:module'
import type { IndexedProject, ProjectModuleInfo, ProjectUiState } from '../../shared/projectTypes.js'
import { DEFAULT_COLUMN_WIDTHS } from '../../shared/projectTypes.js'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath: string | null = null

function resolveSqlWasm(): string {
  const require = createRequire(import.meta.url)
  try {
    return require.resolve('sql.js/dist/sql-wasm.wasm')
  } catch {
    const here = dirname(fileURLToPath(import.meta.url))
    const candidates = [
      join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      join(process.cwd(), 'packages/studio/node_modules/sql.js/dist/sql-wasm.wasm'),
      join(here, '../../../../node_modules/sql.js/dist/sql-wasm.wasm'),
      join(here, '../../../node_modules/sql.js/dist/sql-wasm.wasm')
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    throw new Error('sql.js wasm not found')
  }
}

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL
  SQL = await initSqlJs({
    wasmBinary: readFileSync(resolveSqlWasm())
  })
  return SQL
}

function persist(): void {
  if (!db || !dbPath) return
  mkdirSync(dirname(dbPath), { recursive: true })
  writeFileSync(dbPath, Buffer.from(db.export()))
}

function migrate(database: Database): void {
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
  `)
}

export async function openProjectIndex(filePath: string): Promise<void> {
  const sql = await getSql()
  dbPath = filePath
  if (existsSync(filePath)) {
    db = new sql.Database(readFileSync(filePath))
  } else {
    mkdirSync(dirname(filePath), { recursive: true })
    db = new sql.Database()
  }
  migrate(db)
  persist()
}

function requireDb(): Database {
  if (!db) throw new Error('Project index database is not open')
  return db
}

export function listProjects(): IndexedProject[] {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT id, name, root_path, created_at, last_opened_at FROM projects ORDER BY last_opened_at DESC'
  )
  const rows: IndexedProject[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as {
      id: string
      name: string
      root_path: string
      created_at: number
      last_opened_at: number
    }
    rows.push({
      id: r.id,
      name: r.name,
      rootPath: r.root_path,
      createdAt: r.created_at,
      lastOpenedAt: r.last_opened_at
    })
  }
  stmt.free()
  return rows
}

export function upsertProject(input: {
  id?: string
  name: string
  rootPath: string
}): IndexedProject {
  const database = requireDb()
  const now = Date.now()
  const existing = database.prepare('SELECT id, created_at FROM projects WHERE root_path = ?')
  existing.bind([input.rootPath])
  if (existing.step()) {
    const row = existing.getAsObject() as { id: string; created_at: number }
    existing.free()
    database.run('UPDATE projects SET name = ?, last_opened_at = ? WHERE id = ?', [
      input.name,
      now,
      row.id
    ])
    persist()
    return {
      id: row.id,
      name: input.name,
      rootPath: input.rootPath,
      createdAt: row.created_at,
      lastOpenedAt: now
    }
  }
  existing.free()
  const id = input.id ?? randomUUID()
  database.run(
    'INSERT INTO projects (id, name, root_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
    [id, input.name, input.rootPath, now, now]
  )
  persist()
  return { id, name: input.name, rootPath: input.rootPath, createdAt: now, lastOpenedAt: now }
}

export function touchProject(id: string): void {
  requireDb().run('UPDATE projects SET last_opened_at = ? WHERE id = ?', [Date.now(), id])
  persist()
}

export function removeProject(id: string): void {
  const database = requireDb()
  database.run('DELETE FROM modules WHERE project_id = ?', [id])
  database.run('DELETE FROM files WHERE project_id = ?', [id])
  database.run('DELETE FROM ui_state WHERE project_id = ?', [id])
  database.run('DELETE FROM projects WHERE id = ?', [id])
  persist()
}

export function replaceProjectModules(projectId: string, modules: ProjectModuleInfo[]): void {
  const database = requireDb()
  database.run('DELETE FROM modules WHERE project_id = ?', [projectId])
  const stmt = database.prepare(
    'INSERT INTO modules (project_id, name, file_path, is_gui, parent_name, cached_json) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const mod of modules) {
    stmt.run([
      projectId,
      mod.name,
      mod.filePath,
      mod.isGui ? 1 : 0,
      mod.parentName ?? null,
      JSON.stringify(mod)
    ])
  }
  stmt.free()
  persist()
}

export function cachedModules(projectId: string): ProjectModuleInfo[] {
  const database = requireDb()
  const stmt = database.prepare('SELECT cached_json FROM modules WHERE project_id = ?')
  stmt.bind([projectId])
  const out: ProjectModuleInfo[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { cached_json: string }
    try {
      out.push(JSON.parse(row.cached_json) as ProjectModuleInfo)
    } catch {
      /* skip */
    }
  }
  stmt.free()
  return out
}

export function getUiState(projectId: string): ProjectUiState {
  const database = requireDb()
  const stmt = database.prepare(
    'SELECT informal_collapsed, column_widths, selected_module, expanded FROM ui_state WHERE project_id = ?'
  )
  stmt.bind([projectId])
  if (stmt.step()) {
    const row = stmt.getAsObject() as {
      informal_collapsed: number
      column_widths: string | null
      selected_module: string | null
      expanded: number
    }
    stmt.free()
    let widths = DEFAULT_COLUMN_WIDTHS
    try {
      if (row.column_widths) widths = JSON.parse(row.column_widths) as number[]
    } catch {
      widths = DEFAULT_COLUMN_WIDTHS
    }
    return {
      informalCollapsed: Boolean(row.informal_collapsed),
      columnWidths: widths.length === 4 ? widths : DEFAULT_COLUMN_WIDTHS,
      selectedModuleName:
        typeof row.selected_module === 'string' ? row.selected_module : null,
      expanded: row.expanded !== 0
    }
  }
  stmt.free()
  return {
    informalCollapsed: false,
    columnWidths: [...DEFAULT_COLUMN_WIDTHS],
    selectedModuleName: null,
    expanded: true
  }
}

export function saveUiState(projectId: string, state: ProjectUiState): void {
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
  )
  persist()
}

export function closeProjectIndex(): void {
  persist()
  db?.close()
  db = null
}
