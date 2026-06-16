import type { AspecDocument, AspecDiagnostic, BookAlignSection } from './model.js'
import { createDiagnostic, DiagnosticCodes } from './diagnostics/codes.js'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function asBookAlign(raw: Record<string, unknown> | undefined): BookAlignSection | null {
  if (!raw) return null
  return raw as unknown as BookAlignSection
}

/** Validate Agile-SOFL book Ch.3 informal spec style (Functions / Data / Constraints). */
export function validateBookAlign(document: AspecDocument, strict = false): AspecDiagnostic[] {
  const diagnostics: AspecDiagnostic[] = []
  const book = asBookAlign(document.bookAlign as Record<string, unknown> | undefined)

  const processCount = document.modules.reduce((n, m) => n + (m.processes?.length ?? 0), 0)
  if (processCount === 0) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.BOOK_ALIGN_NO_FUNCTIONS,
        'Informal spec should document at least one function (process)',
        strict ? 'error' : 'warning',
        'modules'
      )
    )
  }

  if (book?.functions?.length) {
    for (const fn of book.functions) {
      if (!isNonEmptyString(fn.ref) || !isNonEmptyString(fn.description)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_FUNCTION_FORMAT,
            'Each bookAlign.functions entry needs ref and description',
            strict ? 'error' : 'warning',
            'bookAlign.functions'
          )
        )
      }
    }
  }

  if (book?.data?.length) {
    for (const item of book.data) {
      if (!isNonEmptyString(item.ref) || !isNonEmptyString(item.description)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_DATA_FORMAT,
            'Each bookAlign.data entry needs ref and description',
            strict ? 'error' : 'warning',
            'bookAlign.data'
          )
        )
      } else if (!item.usedBy?.length) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_DATA_REFS,
            `Data item ${item.ref} should list usedBy function refs (e.g. F_1)`,
            'info',
            `bookAlign.data.${item.ref}`
          )
        )
      }
    }
  }

  if (book?.constraints?.length) {
    for (const c of book.constraints) {
      if (!isNonEmptyString(c.ref) || !isNonEmptyString(c.description)) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_CONSTRAINT_FORMAT,
            'Each bookAlign.constraints entry needs ref and description',
            strict ? 'error' : 'warning',
            'bookAlign.constraints'
          )
        )
      } else if (!c.refs?.length) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_CONSTRAINT_REFS,
            `Constraint ${c.ref} should reference functions (F_n) and/or data (D_n)`,
            'info',
            `bookAlign.constraints.${c.ref}`
          )
        )
      }
    }
  } else if (processCount > 0 && strict) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.BOOK_ALIGN_NO_CONSTRAINTS,
        'Consider documenting constraints in bookAlign.constraints (Ch.3 §III)',
        'warning',
        'bookAlign.constraints'
      )
    )
  }

  const names = new Set<string>()
  for (const mod of document.modules) {
    for (const p of mod.processes ?? []) {
      const lower = p.name.toLowerCase()
      if (names.has(lower)) continue
      names.add(lower)
      if (/\bborrow\b/i.test(p.name) && !names.has('return') && !document.modules.some((m) =>
        m.processes?.some((x) => /return/i.test(x.name))
      )) {
        diagnostics.push(
          createDiagnostic(
            DiagnosticCodes.BOOK_ALIGN_SYMMETRIC,
            `Process '${p.name}' may need a symmetric counterpart (e.g. Return) per Ch.5 §5.1.1`,
            'info',
            `modules.${mod.id}.processes.${p.id}`
          )
        )
      }
    }
  }

  const sharedVars = document.modules.flatMap((m) => m.variables ?? [])
  if (processCount > 1 && sharedVars.length === 0 && !book?.data?.length) {
    diagnostics.push(
      createDiagnostic(
        DiagnosticCodes.BOOK_ALIGN_SHARED_DATA,
        'Document shared data items (bookAlign.data or module variables used by multiple processes)',
        'info',
        'bookAlign.data'
      )
    )
  }

  return diagnostics
}
