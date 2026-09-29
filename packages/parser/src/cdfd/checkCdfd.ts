/**
 * Structural CDFD checks: names, boundary balance, condition outlets, decom targets.
 */

import type { ModuleNode, ProcessNode, ProgramNode } from '../ast/nodes.js'
import { textOf } from '../ast/nodes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { createDiagnostic, DiagnosticCodes } from '../diagnostics/codes.js'
import { printPredicate } from '../transform/print.js'

export interface CheckCdfdOptions {
  refinementStrict?: boolean
}

function moduleKey(name: string): string {
  return name.startsWith('SYSTEM_') ? name.slice('SYSTEM_'.length) : name
}

function paramNames(proc: ProcessNode, side: 'inputs' | 'outputs'): string[] {
  return proc[side].flatMap((g) => g.names)
}

function findModule(program: ProgramNode, name: string): ModuleNode | undefined {
  const key = moduleKey(name)
  return program.modules.find((m) => m.name === name || moduleKey(m.name) === key || `SYSTEM_${m.name}` === name)
}

function parentProcessesTargeting(program: ProgramNode, child: ModuleNode): Array<{ module: ModuleNode; process: ProcessNode }> {
  const hits: Array<{ module: ModuleNode; process: ProcessNode }> = []
  const childKey = moduleKey(child.name)
  for (const mod of program.modules) {
    for (const proc of mod.processes) {
      const decom = textOf(proc.body?.decomposition)?.trim()
      if (!decom) continue
      if (moduleKey(decom) === childKey || decom === child.name || decom === `SYSTEM_${child.name}`) {
        hits.push({ module: mod, process: proc })
      }
    }
  }
  return hits
}

export function checkCdfd(program: ProgramNode, options?: CheckCdfdOptions): { diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []

  for (const mod of program.modules) {
    const processes = mod.processes.filter((p) => !p.alias)
    if (options?.refinementStrict && processes.length > 0 && !mod.cdfd) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.CDFD_MISSING,
          `Module '${mod.name}' has processes but no cdfd block`,
          'error',
          mod.span
        )
      )
    }

    for (const proc of mod.processes) {
      const decom = textOf(proc.body?.decomposition)?.trim()
      if (!decom) continue
      const target = findModule(program, decom)
      if (!target) {
        const looksLikeProcess = processes.some((p) => p.name === decom) ||
          program.modules.some((m) => m.processes.some((p) => p.name === decom) || m.functions.some((f) => f.name === decom))
        diagnostics.push(
          createDiagnostic(
            looksLikeProcess ? DiagnosticCodes.CDFD_DECOM_NOT_MODULE : DiagnosticCodes.CDFD_DECOM_UNRESOLVED,
            looksLikeProcess
              ? `Process '${proc.name}' decom '${decom}' must name a module, not a process or function`
              : `Process '${proc.name}' decom '${decom}' does not resolve to a module`,
            options?.refinementStrict ? 'error' : 'warning',
            typeof proc.body?.decomposition === 'object' ? proc.body.decomposition.span : proc.span
          )
        )
        continue
      }
      const parentKey = target.parent ? moduleKey(target.parent.name) : ''
      if (parentKey && parentKey !== moduleKey(mod.name) && target.parent?.name !== mod.name) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_DECOM_UNRESOLVED,
            `Module '${target.name}' parent '${target.parent?.name}' does not match decomposing module '${mod.name}'`,
            'warning',
            target.span
          )
        )
      }
    }

    const cdfd = mod.cdfd
    if (!cdfd) continue

    if ((cdfd.extraBlockCount ?? 0) > 0) {
      diagnostics.push(
        createDiagnostic(
          DiagnosticCodes.CDFD_DUPLICATE,
          `Module '${mod.name}' has more than one cdfd block; only the first is used`,
          'error',
          cdfd.span
        )
      )
    }

    const processNames = new Set(processes.map((p) => p.name))
    const varNames = new Set(mod.vars.map((v) => v.variable.name))
    const portNames = new Set(cdfd.ports.map((p) => p.name))
    const storeNames = new Set(cdfd.stores.map((s) => s.name))
    const nodeNames = new Set(cdfd.nodes.map((n) => n.name))
    const condNames = new Set(cdfd.conditions.map((c) => c.name))
    const endpoints = new Set([...portNames, ...storeNames, ...nodeNames, ...condNames])

    for (const node of cdfd.nodes) {
      if (!processNames.has(node.name)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_UNKNOWN_NODE,
            `CDFD node '${node.name}' is not a process in module '${mod.name}'`,
            'error',
            node.span
          )
        )
      }
    }
    for (const store of cdfd.stores) {
      if (!varNames.has(store.name)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_UNKNOWN_STORE,
            `CDFD store '${store.name}' is not a var in module '${mod.name}'`,
            'error',
            store.span
          )
        )
      }
    }
    for (const proc of processes) {
      if (!nodeNames.has(proc.name)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_PROCESS_NOT_ON_GRAPH,
            `Process '${proc.name}' is missing from the cdfd of module '${mod.name}'`,
            'warning',
            proc.span
          )
        )
      }
    }

    for (const flow of cdfd.flows) {
      if (!endpoints.has(flow.from)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_UNKNOWN_ENDPOINT,
            `CDFD flow source '${flow.from}' is not a port, store, node, or cond`,
            'error',
            flow.span
          )
        )
      }
      if (!endpoints.has(flow.to)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_UNKNOWN_ENDPOINT,
            `CDFD flow target '${flow.to}' is not a port, store, node, or cond`,
            'error',
            flow.span
          )
        )
      }

      const fromStore = storeNames.has(flow.from)
      const toStore = storeNames.has(flow.to)
      const fromNode = nodeNames.has(flow.from)
      const toNode = nodeNames.has(flow.to)
      if (fromStore && toNode) {
        const proc = processes.find((p) => p.name === flow.to)
        const hasRd = proc?.body?.ext.some((e) => e.access === 'rd' && e.name === flow.from)
        if (proc && !hasRd) {
          diagnostics.push(
            createDiagnostic(
              DiagnosticCodes.CDFD_STORE_EXT,
              `Flow ${flow.from} -> ${flow.to} should match ext rd ${flow.from} on process '${flow.to}'`,
              'warning',
              flow.span
            )
          )
        }
      }
      if (fromNode && toStore) {
        const proc = processes.find((p) => p.name === flow.from)
        const hasWr = proc?.body?.ext.some((e) => e.access === 'wr' && e.name === flow.to)
        if (proc && !hasWr) {
          diagnostics.push(
            createDiagnostic(
              DiagnosticCodes.CDFD_STORE_EXT,
              `Flow ${flow.from} -> ${flow.to} should match ext wr ${flow.to} on process '${flow.from}'`,
              'warning',
              flow.span
            )
          )
        }
      }
    }

    for (const cond of cdfd.conditions) {
      const outs = cdfd.flows.filter((f) => f.from === cond.name)
      if (outs.length < 2) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_COND_EDGES,
            `Condition node '${cond.name}' needs at least two outgoing flows`,
            'error',
            cond.span
          )
        )
        continue
      }
      const guarded = outs.filter((f) => f.isOthers || f.guard)
      if (guarded.length < 2) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_COND_EDGES,
            `Condition node '${cond.name}' outgoing flows must carry guards`,
            'warning',
            cond.span
          )
        )
      }
      const hasOthers = outs.some((f) => f.isOthers)
      const guards = outs
        .filter((f) => !f.isOthers && f.guard)
        .map((f) => printPredicate(f.guard!))
      const uniqueGuards = new Set(guards)
      if (uniqueGuards.size < guards.length) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_COND_OPEN,
            `Condition node '${cond.name}' has overlapping (syntactically identical) guards`,
            'warning',
            cond.span
          )
        )
      }
      if (!hasOthers) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_COND_OPEN,
            `Condition node '${cond.name}' is not a closed partition (add others or an else outlet)`,
            'warning',
            cond.span
          )
        )
      }
    }

    const parents = parentProcessesTargeting(program, mod)
    for (const { process: parentProc } of parents) {
      const expectedIn = paramNames(parentProc, 'inputs')
      const expectedOut = paramNames(parentProc, 'outputs')
      const actualIn = cdfd.ports.filter((p) => p.direction === 'in').map((p) => p.name)
      const actualOut = cdfd.ports.filter((p) => p.direction === 'out').map((p) => p.name)
      const same = (a: string[], b: string[]) => a.length === b.length && a.every((n) => b.includes(n))
      if (!same(expectedIn, actualIn) || !same(expectedOut, actualOut)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.CDFD_BOUNDARY,
            `CDFD ports of '${mod.name}' must match process '${parentProc.name}' inputs [${expectedIn.join(', ')}] and outputs [${expectedOut.join(', ')}]`,
            'error',
            cdfd.span
          )
        )
      }
      for (const ext of parentProc.body?.ext ?? []) {
        if (!storeNames.has(ext.name)) {
          diagnostics.push(
            createDiagnostic(
              DiagnosticCodes.CDFD_BOUNDARY,
              `Parent process '${parentProc.name}' ext ${ext.access} ${ext.name} has no matching store on '${mod.name}' CDFD`,
              'warning',
              cdfd.span
            )
          )
        }
      }
    }
  }

  return { diagnostics }
}
