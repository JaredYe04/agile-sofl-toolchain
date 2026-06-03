import { describe, it, expect } from 'vitest'
import { check } from '../../src/index'
import { expectDiagnostic } from '../helpers/index'
import { parseStrict } from '../../src/parser/parse'
import { typeCheck } from '../../src/typecheck/checker'
import { resolveScope } from '../../src/scope/resolver'
import { isProgramNode } from '../../src/ast/guards'

function typeCheckDiagnostics(source: string) {
  const result = parseStrict(source)
  expect(result.ast).not.toBeNull()
  if (!result.ast || !isProgramNode(result.ast)) throw new Error('expected program')
  const scope = resolveScope(result.ast)
  return typeCheck(result.ast, scope).diagnostics
}

const FSF_OK = 'x > 0 && x = x'

describe('Type mismatch errors', () => {
  it('reports function return mismatch', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): nat
== flag
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports bool body against int return', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): int
== flag
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports real return when nat expected', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (): nat
== 1.5
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports ext wr type mismatch', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var b: int;
process P ()
ext
wr b: nat
FSF :
${FSF_OK}
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports non-bool expression in invariant', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var x: int;
inv x + 1;
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports non-bool identifier in FSF when typed as int', () => {
    const { diagnostics } = check(`module SYSTEM_T;
process P (x: int)
FSF :
x && x = x
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })
})

describe('Unknown type errors', () => {
  it('reports unknown variable type name', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var x: NoSuchType;
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })

  it('reports unknown process input type', () => {
    const { diagnostics } = check(`module SYSTEM_T;
process P (x: GhostType)
FSF :
${FSF_OK}
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })

  it('reports unknown process output type', () => {
    const { diagnostics } = check(`module SYSTEM_T;
process P () y: Missing
FSF :
${FSF_OK}
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })

  it('reports unknown function parameter type', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (x: UnknownT): nat
== 1
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })

  it('reports unknown function return type', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (): NotAType
== 1
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })

  it('reports unknown type alias RHS', () => {
    const { diagnostics } = check(`module SYSTEM_T;
type T = MissingAlias;
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_002')).toBe(true)
  })
})

describe('Invalid builtin errors', () => {
  it('reports typo lenn as invalid builtin', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (s: seq of nat): int
== lenn(s)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_003')).toBe(true)
  })

  it('reports typo abss as invalid builtin', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (x: int): int
== abss(x)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_003')).toBe(true)
  })

  it('does not flag user-defined camelCase calls', () => {
    const { diagnostics } = check(`module SYSTEM_T;
type T = nat;
function mkFn (): T
== mk_T(1)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_003')).toBe(false)
  })
})

describe('If/case branch mismatch', () => {
  it('reports incompatible if branches against return type', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): nat
== if flag then 1.5 else 1
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })
})

describe('Call arity and argument type errors', () => {
  it('reports wrong builtin argument type for abs', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): int
== abs(flag)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports wrong builtin argument type for floor on bool', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): int
== floor(flag)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports user function arity too few', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function add (a: nat, b: nat): nat
== a + b
end_function
function f (): nat
== add(1)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports user function arity too many', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function twice (x: nat): nat
== x + x
end_function
function f (): nat
== twice(1, 2)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports user call with bool argument for nat parameter', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function take (x: nat): nat
== x
end_function
function f (): nat
== take(flag)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports user call with real argument for nat parameter', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function take (x: nat): nat
== x
end_function
function f (): nat
== take(1.5)
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports nested user call arity error', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function pair (a: nat, b: nat): nat
== a + b
end_function
function f (): nat
== pair(pair(1))
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })
})

describe('Strict unknown type compatibility', () => {
  it('reports user call with unknown argument under strict compatibility', () => {
    const diagnostics = typeCheckDiagnostics(`module SYSTEM_T;
function take (x: nat): nat
== x
end_function
function f (): nat
== take(ghost)
end_function
end_module`)
    expect(
      diagnostics.some(
        (d) => d.code === 'ASFL_TYPE_001' && d.message.includes("Argument 1 to 'take'")
      )
    ).toBe(true)
  })

  it('reports ext wr strict mismatch when annotation is not compatible', () => {
    const diagnostics = typeCheckDiagnostics(`module SYSTEM_T;
var flag: bool;
process P ()
ext
wr flag: nat
FSF :
${FSF_OK}
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports ext rd strict mismatch for bool variable annotated as nat', () => {
    const diagnostics = typeCheckDiagnostics(`module SYSTEM_T;
var flag: bool;
process P ()
ext
rd flag: nat
FSF :
${FSF_OK}
end_process
end_module`)
    expect(
      diagnostics.some(
        (d) => d.code === 'ASFL_TYPE_001' && d.message.includes("ext rd 'flag'")
      )
    ).toBe(true)
  })

  it('reports ext wr strict mismatch', () => {
    const diagnostics = typeCheckDiagnostics(`module SYSTEM_T;
var b: int;
process P ()
ext
wr b: nat
FSF :
${FSF_OK}
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports strict mismatch for real literal against nat return', () => {
    const { diagnostics } = check(`module SYSTEM_T;
function f (): nat
== 2.0
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('reports strict mismatch for real branch against nat return', () => {
    const { diagnostics } = check(`module SYSTEM_T;
var flag: bool;
function f (): nat
== if flag then 1.5 else 1
end_function
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(true)
  })

  it('does not treat unknown as bool in FSF when checked via full pipeline scope', () => {
    const { diagnostics } = check(`module SYSTEM_T;
process P ()
FSF :
ghost && true
end_process
end_module`)
    expect(expectDiagnostic(diagnostics, 'ASFL_SCOPE_001')).toBe(true)
    expect(expectDiagnostic(diagnostics, 'ASFL_TYPE_001')).toBe(false)
  })
})
