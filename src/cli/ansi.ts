/** Minimal ANSI helpers (no dependencies). */

const enabled = process.stdout.isTTY === true && process.env.NO_COLOR !== '1'

export const ansi = {
  reset: enabled ? '\x1b[0m' : '',
  bold: enabled ? '\x1b[1m' : '',
  dim: enabled ? '\x1b[2m' : '',
  red: enabled ? '\x1b[31m' : '',
  green: enabled ? '\x1b[32m' : '',
  yellow: enabled ? '\x1b[33m' : '',
  blue: enabled ? '\x1b[34m' : '',
  cyan: enabled ? '\x1b[36m' : '',
  gray: enabled ? '\x1b[90m' : ''
}

export function color(text: string, code: string): string {
  return `${code}${text}${ansi.reset}`
}
