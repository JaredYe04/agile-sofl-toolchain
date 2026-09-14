/** Matches parser Identifier: ASCII or Unicode letters, digits, underscore. */
export const IDENT_BODY = /[A-Za-z0-9_\u0080-\uFFFF]/u
export const IDENT_START = /[A-Za-z_\u0080-\uFFFF]/u
export const IDENT = /[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*/u
export const IDENT_CAPTURE = /([A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*)/u
export const IDENT_PARTIAL = /[A-Za-z_\u0080-\uFFFF]*/u

export function isIdentifierName(name: string): boolean {
  return /^[A-Za-z_\u0080-\uFFFF][A-Za-z0-9_\u0080-\uFFFF]*$/u.test(name)
}
