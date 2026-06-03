import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { loadFixture, expectDiagnostic } from '../helpers/index'
import {
  typeExprToInternal,
  typesCompatible,
  typeToString,
  resolveInternalType,
  isNumericType,
  numericSubtype
} from '../../src/typecheck/types'
import { typeCheck } from '../../src/typecheck/checker'
import { parseStrict } from '../../src/parser/parse'
import { isProgramNode } from '../../src/ast/guards'

function expectNoTypeErrors(source: string) {
  const { diagnostics } = check(source)
  const typeErrors = diagnostics.filter(
    (d) => d.severity === 'error' && d.code.startsWith('ASFL_TYPE_')
  )
  expect(typeErrors).toEqual([])
}

function parseProgram(source: string) {
  const result = parseStrict(source)
  expect(result.ast).not.toBeNull()
  if (!result.ast || !isProgramNode(result.ast)) throw new Error('expected program')
  return result.ast
}

describe('Numeric subtyping', () => {
  it('nat0 is compatible with nat', () => {
    expect(numericSubtype({ kind: 'basic', name: 'nat0' }, { kind: 'basic', name: 'nat' })).toBe(true)
  })

  it('nat is compatible with int', () => {
    expect(typesCompatible({ kind: 'basic', name: 'nat' }, { kind: 'basic', name: 'int' })).toBe(true)
  })

  it('int is compatible with real', () => {
    expect(typesCompatible({ kind: 'basic', name: 'int' }, { kind: 'basic', name: 'real' })).toBe(true)
  })

  it('real is not compatible with nat', () => {
    expect(typesCompatible({ kind: 'basic', name: 'real' }, { kind: 'basic', name: 'nat' })).toBe(false)
  })

  it('nat0 chain through real', () => {
    expect(typesCompatible({ kind: 'basic', name: 'nat0' }, { kind: 'basic', name: 'real' })).toBe(true)
  })

  it('bool is not numeric', () => {
    expect(isNumericType({ kind: 'basic', name: 'bool' })).toBe(false)
  })
})

describe('typeToString composed and union', () => {
  it('formats composed type', () => {
    const t = typeExprToInternal({
      type: 'composed_type',
      span: { start: 0, end: 0, line: 1, column: 1 },
      fields: [
        {
          name: 'x',
          typeExpr: { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'nat' }
        },
        {
          name: 'y',
          typeExpr: { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'int' }
        }
      ]
    })
    expect(typeToString(t)).toBe('composed of x: nat y: int end')
  })

  it('formats union variants', () => {
    const t = typeExprToInternal({
      type: 'union_type',
      span: { start: 0, end: 0, line: 1, column: 1 },
      variants: [
        { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'nat' },
        { type: 'basic_type', span: { start: 0, end: 0, line: 1, column: 1 }, name: 'int' }
      ],
      isUniversal: false
    })
    expect(typeToString(t)).toBe('nat | int')
  })
})

describe('Named type resolution', () => {
  it('resolves type aliases in env', () => {
    const env = new Map([
      ['Local', { kind: 'basic', name: 'nat' }],
      ['Wrap', { kind: 'named', name: 'Local' }]
    ])
    const resolved = resolveInternalType({ kind: 'named', name: 'Wrap' }, env)
    expect(resolved).toEqual({ kind: 'basic', name: 'nat' })
  })
})

describe('Expression inference (accepting programs)', () => {
  it('accepts if-then-else with matching numeric branches', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var flag: bool;
function f (): int
== if flag then 1 else 2
end_function
end_module`)
  })

  it('accepts let binding with inferred names', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (): int
== let x = 1 in x + 1
end_function
end_module`)
  })

  it('accepts case expression with uniform branches', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (x: int): int
== case x of
   1 -> 2; 2 -> 3
   ; default -> 0
   end_case
end_function
end_module`)
  })

  it('accepts field access on composed type', () => {
    expectNoTypeErrors(`module SYSTEM_T;
type R = composed of x: nat y: int end;
function f (r: R): nat
== r.x
end_function
end_module`)
  })

  it('accepts index on seq', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (s: seq of nat): nat
== s[1]
end_function
end_module`)
  })

  it('accepts mk with type alias', () => {
    expectNoTypeErrors(`module SYSTEM_T;
type T = nat;
function f (): T
== mk_T(1)
end_function
end_module`)
  })

  it('accepts modify on composed value', () => {
    expectNoTypeErrors(`module SYSTEM_T;
type R = composed of x: nat y: int end;
function f (r: R): R
== modify(r, x -> 2)
end_function
end_module`)
  })

  it('accepts builtin card on set', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (s: set of nat): int
== card(s)
end_function
end_module`)
  })

  it('accepts builtin len on seq', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (s: seq of nat): int
== len(s)
end_function
end_module`)
  })

  it('accepts binary arithmetic', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (a: nat, b: int): int
== a + b
end_function
end_module`)
  })

  it('accepts nat0 variable with nat return via subtyping', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var z: nat0;
function f (): nat
== z
end_function
end_module`)
  })

  it('accepts const in type env for identifier', () => {
    expectNoTypeErrors(`module SYSTEM_T;
const limit = 100;
function f (): int
== limit
end_function
end_module`)
  })

  it('accepts process parameter types in FSF', () => {
    expectNoTypeErrors(`module SYSTEM_T;
process P (x: int) y: nat
FSF :
x > 0 && y > 0
end_process
end_module`)
  })

  it('accepts relational expression in invariant', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var x: int;
inv x > 0;
end_module`)
  })

  it('accepts banking integration fixture', () => {
    const source = loadFixture('integration/banking.asfl')
    expectNoTypeErrors(source)
  })

  it('puts process params in env for body checks', () => {
    const program = parseProgram(`module SYSTEM_T;
process P (a: int) b: nat
FSF :
a > 0 && b > 0
end_process
end_module`)
    const diags = typeCheck(program).diagnostics.filter((d) => d.code === 'ASFL_TYPE_001')
    expect(diags).toHaveLength(0)
  })
})

describe('Comprehension inference', () => {
  it('accepts set comprehension in const', () => {
    expectNoTypeErrors(`module SYSTEM_T;
const S = {n | n: nat & n > 0};
end_module`)
  })

  it('accepts seq comprehension in function return', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function f (): seq of int
== [i | i: int & i > 0]
end_function
end_module`)
  })

  it('accepts map comprehension with key and value', () => {
    expectNoTypeErrors(`module SYSTEM_T;
const M = {k -> k * 2 | k: nat & k < 5};
end_module`)
  })

  it('accepts set comprehension in FSF', () => {
    expectNoTypeErrors(`module SYSTEM_T;
process P ()
FSF :
others && 1 inset { n | n: nat & n mod 2 = 0 }
end_process
end_module`)
  })

  it('accepts comprehension-types grammar fixture via check', () => {
    expectNoTypeErrors(loadFixture('grammar/expressions/comprehension-types.asfl'))
  })
})

describe('User function call inference', () => {
  it('accepts call with matching arity and types', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function add (a: nat, b: nat): nat
== a + b
end_function
function f (): nat
== add(1, 2)
end_function
end_module`)
  })

  it('accepts nested user calls', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function inc (x: nat): nat
== x + 1
end_function
function twice (x: nat): nat
== inc(inc(x))
end_function
end_module`)
  })

  it('accepts user call with nat0 argument via subtyping', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var z: nat0;
function take (x: nat): nat
== x
end_function
function f (): nat
== take(z)
end_function
end_module`)
  })

  it('accepts zero-arity user function call', () => {
    expectNoTypeErrors(`module SYSTEM_T;
function zero (): nat
== 0
end_function
function f (): nat
== zero()
end_function
end_module`)
  })
})

describe('Process ext rd inference', () => {
  it('accepts ext rd when variable type matches', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var total: nat;
process P ()
ext
rd total: nat
FSF :
others && total > 0
end_process
end_module`)
  })

  it('accepts ext rd with int variable and int annotation', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var balance: int;
process P ()
ext
rd balance: int
FSF :
others && balance >= 0
end_process
end_module`)
  })

  it('accepts ext-alias fixture ext rd types', () => {
    expectNoTypeErrors(loadFixture('grammar/processes/ext-alias.asfl'))
  })

  it('accepts ext rd and wr on same process', () => {
    expectNoTypeErrors(`module SYSTEM_T;
var a: nat;
var b: int;
process P ()
ext
rd a: nat
wr b: int
FSF :
others && a > 0 && b > 0
end_process
end_module`)
  })

  it('accepts ext rd in typeCheck direct on banking-like snippet', () => {
    const program = parseProgram(`module SYSTEM_T;
var x: nat;
process P ()
ext
rd x: nat
FSF :
others && x > 0
end_process
end_module`)
    const errs = typeCheck(program).diagnostics.filter((d) => d.severity === 'error')
    expect(errs).toHaveLength(0)
  })
})

describe('typeCheck direct', () => {
  it('returns empty diagnostics for minimal valid module', () => {
    const program = parseProgram(`module SYSTEM_T;
var x: nat;
end_module`)
    expect(typeCheck(program).diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })
})
