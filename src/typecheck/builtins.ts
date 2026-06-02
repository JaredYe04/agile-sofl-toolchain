/**
 * Built-in function signatures for type checking.
 */

export interface BuiltinSignature {
  name: string
  argTypes: string[]
  returnType: string
}

export const BUILTIN_FUNCTIONS: Record<string, BuiltinSignature> = {
  abs: { name: 'abs', argTypes: ['number'], returnType: 'number' },
  floor: { name: 'floor', argTypes: ['number'], returnType: 'number' },
  card: { name: 'card', argTypes: ['set'], returnType: 'number' },
  len: { name: 'len', argTypes: ['seq'], returnType: 'number' },
  get: { name: 'get', argTypes: ['set'], returnType: 'bool' },
  hd: { name: 'hd', argTypes: ['seq'], returnType: 'bool' },
  tl: { name: 'tl', argTypes: ['seq'], returnType: 'seq' },
  union: { name: 'union', argTypes: ['set', 'set'], returnType: 'set' },
  inter: { name: 'inter', argTypes: ['set', 'set'], returnType: 'set' },
  diff: { name: 'diff', argTypes: ['set', 'set'], returnType: 'set' },
  subset: { name: 'subset', argTypes: ['set', 'set'], returnType: 'bool' },
  psubset: { name: 'psubset', argTypes: ['set', 'set'], returnType: 'bool' },
  bound: { name: 'bound', argTypes: ['identifier'], returnType: 'bool' },
  dom: { name: 'dom', argTypes: ['map'], returnType: 'set' },
  rng: { name: 'rng', argTypes: ['map'], returnType: 'set' },
  domrt: { name: 'domrt', argTypes: ['set', 'map'], returnType: 'map' },
  comp: { name: 'comp', argTypes: ['map', 'map'], returnType: 'map' },
  conc: { name: 'conc', argTypes: ['seq', 'seq'], returnType: 'seq' }
}

export function isBuiltin(name: string): boolean {
  return name in BUILTIN_FUNCTIONS
}
