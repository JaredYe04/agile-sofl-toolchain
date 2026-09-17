import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listProjects,
  openProjectIndex,
  removeProject,
  replaceProjectModules,
  cachedModules,
  saveUiState,
  getUiState,
  upsertProject
} from '../src/main/services/projectIndexDb'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('projectIndexDb', () => {
  it('persists projects, modules, and ui state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'asfl-db-'))
    dirs.push(dir)
    await openProjectIndex(join(dir, 'studio-index.sqlite'))
    const project = upsertProject({ name: 'Alpha', rootPath: join(dir, 'alpha') })
    expect(listProjects().some((p) => p.id === project.id)).toBe(true)
    replaceProjectModules(project.id, [
      {
        name: 'Lib',
        displayName: 'SYSTEM_Lib',
        filePath: join(dir, 'alpha', 'hybrid.asfl'),
        isSystem: true,
        isGui: false,
        spanStart: 0,
        spanEnd: 10
      }
    ])
    expect(cachedModules(project.id)[0]?.name).toBe('Lib')
    saveUiState(project.id, {
      informalCollapsed: true,
      structureCollapsed: true,
      columnWidths: [0.2, 0.2, 0.4, 0.2],
      selectedModuleName: 'Lib',
      expanded: true
    })
    expect(getUiState(project.id).informalCollapsed).toBe(true)
    expect(getUiState(project.id).structureCollapsed).toBe(true)
    expect(getUiState(project.id).selectedModuleName).toBe('Lib')
    removeProject(project.id)
    expect(listProjects()).toHaveLength(0)
  })
})
