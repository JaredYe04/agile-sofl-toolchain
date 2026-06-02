/**
 * Pretty-printer: AST → Agile-SOFL source text with 4-space semantic indentation.
 */

import type {
  ProgramNode,
  ModuleNode,
  ExpressionNode,
  TypeExprNode,
  TypeDeclNode,
  PredicateNode,
  FsfSpecNode,
  ProcessNode,
  FunctionNode,
  ParamGroupNode,
  ExtVarNode
} from '../ast/nodes.js'

const INDENT = '    '

class IndentWriter {
  private readonly lines: string[] = []

  line(level: number, text: string): void {
    this.lines.push(INDENT.repeat(Math.max(0, level)) + text)
  }

  toString(): string {
    return this.lines.join('\n')
  }
}

function printType(type: TypeExprNode): string {
  switch (type.type) {
    case 'basic_type':
      return type.name
    case 'named_type':
      return type.qualified.module
        ? `${type.qualified.module}.${type.qualified.name}`
        : type.qualified.name
    case 'enum_type':
      return `{${type.values.map((v) => `<${v}>`).join(', ')}}`
    case 'set_type':
      return `set of ${printType(type.element)}`
    case 'seq_type':
      return `seq of ${printType(type.element)}`
    case 'composed_type':
      return `composed of ${type.fields.map((f) => `${f.name}: ${printType(f.typeExpr)}`).join(' ')} end`
    case 'product_type':
      return type.elements.map(printType).join(' * ')
    case 'map_type':
      return `map ${printType(type.domain)} to ${printType(type.range)}`
    case 'union_type':
      if (type.isUniversal) return 'universal'
      return type.variants.map(printType).join(' | ')
    default:
      return 'given'
  }
}

function printTypeDeclEntry(writer: IndentWriter, level: number, decl: TypeDeclNode): void {
  const inherit = decl.parentType
    ? ` / ${decl.parentType.module ? `${decl.parentType.module}.` : ''}${decl.parentType.name}`
    : ''
  const expr = decl.typeExpr
  if (expr.type === 'composed_type') {
    writer.line(level, `${decl.name}${inherit} = composed of`)
    for (const field of expr.fields) {
      writer.line(level + 1, `${field.name}: ${printType(field.typeExpr)}`)
    }
    writer.line(level, 'end;')
  } else {
    writer.line(level, `${decl.name}${inherit} = ${printType(expr)};`)
  }
}

function relKindToSymbol(kind: string): string {
  switch (kind) {
    case 'eq':
      return '='
    case 'neq':
      return '<>'
    case 'lt':
      return '<'
    case 'le':
      return '<='
    case 'gt':
      return '>'
    case 'ge':
      return '>='
    case 'inset':
      return 'inset'
    case 'notin':
      return 'notin'
    default:
      return kind
  }
}

function printExpr(expr: ExpressionNode): string {
  switch (expr.type) {
    case 'nil':
      return 'nil'
    case 'boolean_literal':
      return expr.value ? 'true' : 'false'
    case 'number_literal':
      return String(expr.value)
    case 'char_literal':
      return `'${expr.value}'`
    case 'string_literal':
      return `"${expr.value}"`
    case 'enum_literal':
      return `<${expr.value}>`
    case 'identifier':
      if (expr.qualified?.module) return `${expr.qualified.module}.${expr.qualified.name}`
      return `${expr.negated ? '~' : ''}${expr.name}`
    case 'unary_minus':
      return `-${printExpr(expr.operand)}`
    case 'binary_op':
      return `${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)}`
    case 'call':
      return `${typeof expr.callee === 'string' ? expr.callee : printExpr(expr.callee)}(${expr.args.map(printExpr).join(', ')})`
    case 'field_access':
      return `${printExpr(expr.object)}.${expr.field}`
    case 'index_access':
      return `${printExpr(expr.object)}(${printExpr(expr.index)})`
    case 'relational_expr':
      return `${printExpr(expr.left)} ${relKindToSymbol(expr.kind)} ${printExpr(expr.right)}`
    case 'set_expr':
      if (expr.kind === 'empty') return '{}'
      if (expr.kind === 'list') return `{${expr.elements?.map(printExpr).join(', ') ?? ''}}`
      return '{}'
    case 'seq_expr':
      if (expr.kind === 'empty') return '[]'
      if (expr.kind === 'string') return `"${expr.stringValue ?? ''}"`
      if (expr.kind === 'list') return `[${expr.elements?.map(printExpr).join(', ') ?? ''}]`
      return '[]'
    case 'map_expr':
      if (expr.kind === 'empty') return '{->}'
      if (expr.kind === 'pairs' && expr.pairs) {
        return `{${expr.pairs.map((p) => `${printExpr(p.key)} -> ${printExpr(p.value)}`).join(', ')}}`
      }
      return '{->}'
    case 'mk_expr':
      return `mk_${expr.typeName.module ? `${expr.typeName.module}.` : ''}${expr.typeName.name}(${expr.args.map(printExpr).join(', ')})`
    case 'modify_expr':
      return `modify(${printExpr(expr.target)}, ${expr.fields.map((f) => `${f.field} -> ${printExpr(f.value)}`).join(', ')})`
    case 'if_expr':
      return `if ${printPredicate(expr.condition)} then ${printExpr(expr.thenExpr)} else ${printExpr(expr.elseExpr)}`
    case 'let_expr':
      return `let ${expr.bindings.map((b) => b.names.join(',')).join(', ')} in ${printExpr(expr.body)}`
    case 'paren_expr':
      return `(${printExpr(expr.inner)})`
    default:
      return 'nil'
  }
}

function printPredicate(pred: PredicateNode): string {
  return pred.disjuncts
    .map((conj) =>
      conj.atoms
        .map((atom) => {
          if (atom.type === 'informal_text') return atom.text
          if (atom.type === 'relational_expr') return printExpr(atom)
          if (atom.type === 'boolean_literal') return atom.value ? 'true' : 'false'
          if (isExpressionNode(atom)) return printExpr(atom as ExpressionNode)
          if (atom.type === 'not_predicate') return `not ${printAtom(atom.operand)}`
          if (atom.type === 'quantified') {
            const q = atom.quantifier === 'forall' ? 'forall' : atom.quantifier === 'exists_unique' ? 'exists!' : 'exists'
            const binds = atom.bindings.map((b) => `${b.names.join(',')}: ${printType(b.typeExpr)}`).join(', ')
            return `${q}[${binds}] | ${printPredicate(atom.body)}`
          }
          return ''
        })
        .filter(Boolean)
        .join(' and ')
    )
    .filter(Boolean)
    .join(' or ')
}

function printAtom(atom: import('../ast/nodes.js').AtomicPredicateNode): string {
  if (atom.type === 'informal_text') return atom.text
  if (isExpressionNode(atom)) return printExpr(atom as ExpressionNode)
  return ''
}

function isExpressionNode(n: unknown): boolean {
  if (typeof n !== 'object' || n === null) return false
  const t = (n as { type: string }).type
  return !['informal_text', 'not_predicate', 'paren_predicate', 'quantified'].includes(t)
}

function printFsfLines(fsf: FsfSpecNode): string[] {
  const lines: string[] = fsf.scenarios.map(
    (s) => `${printPredicate(s.test)} && ${printPredicate(s.def)}`
  )
  if (fsf.others) {
    lines.push(`others && ${printPredicate(fsf.others)}`)
  }
  return lines
}

function printFsf(writer: IndentWriter, level: number, fsf: FsfSpecNode): void {
  writer.line(level, 'FSF :')
  const lines = printFsfLines(fsf)
  for (let i = 0; i < lines.length; i++) {
    const suffix = i < lines.length - 1 ? ' ||' : ''
    writer.line(level, lines[i] + suffix)
  }
}

function printParams(groups: ParamGroupNode[]): string {
  return groups.map((g) => `${g.names.join(',')}: ${printType(g.typeExpr)}`).join(', ')
}

function printExtLine(ext: ExtVarNode): string {
  return `${ext.access} ${ext.name}${ext.typeExpr ? `: ${printType(ext.typeExpr)}` : ''}`
}

function printProcess(writer: IndentWriter, level: number, p: ProcessNode): void {
  if (p.alias) {
    writer.line(
      level,
      `process ${p.name} equal ${p.alias.module ? `${p.alias.module}.` : ''}${p.alias.name} end_process`
    )
    return
  }

  let header = `process ${p.name} (${printParams(p.inputs)})`
  if (p.outputs.length) header += ` ${printParams(p.outputs)}`
  writer.line(level, header)

  const bodyLevel = level + 1
  if (p.body) {
    if (p.body.ext.length) {
      writer.line(bodyLevel, 'ext')
      for (const ext of p.body.ext) {
        writer.line(bodyLevel, printExtLine(ext))
      }
    }
    if (p.body.fsf) {
      printFsf(writer, bodyLevel, p.body.fsf)
    }
    if (p.body.decomposition) {
      writer.line(bodyLevel, `decom: ${p.body.decomposition}`)
    }
    if (p.body.comment) {
      writer.line(bodyLevel, `comment: ${p.body.comment}`)
    }
  }

  writer.line(level, 'end_process')
}

function printFunction(writer: IndentWriter, level: number, f: FunctionNode): void {
  writer.line(level, `function ${f.name}(${printParams(f.params)}): ${printType(f.returnType)}`)

  const bodyLevel = level + 1
  if (f.fsf) {
    printFsf(writer, bodyLevel, f.fsf)
  }
  if (f.isUndefined) {
    writer.line(bodyLevel, '== undefined')
  } else if (f.body) {
    writer.line(bodyLevel, `== ${printExpr(f.body)}`)
  }

  writer.line(level, 'end_function')
}

function printModule(writer: IndentWriter, level: number, mod: ModuleNode): void {
  if (mod.isSystem) {
    writer.line(level, `module SYSTEM_${mod.name};`)
  } else if (mod.parent) {
    writer.line(level, `module ${mod.name} / ${mod.parent.name};`)
  } else {
    writer.line(level, `module ${mod.name};`)
  }

  const itemLevel = level + 1

  if (mod.consts.length) {
    writer.line(level, 'const')
    for (const c of mod.consts) {
      writer.line(itemLevel, `${c.name} = ${printExpr(c.value)};`)
    }
  }

  if (mod.types.length) {
    writer.line(level, 'type')
    for (const t of mod.types) {
      printTypeDeclEntry(writer, itemLevel, t)
    }
  }

  if (mod.vars.length) {
    writer.line(level, 'var')
    for (const v of mod.vars) {
      writer.line(itemLevel, `${v.variable.name}: ${printType(v.typeExpr)};`)
    }
  }

  if (mod.invariants.length) {
    writer.line(level, 'inv')
    for (const inv of mod.invariants) {
      writer.line(itemLevel, `${printPredicate(inv.condition)};`)
    }
  }

  for (const p of mod.processes) {
    printProcess(writer, level, p)
  }

  for (const f of mod.functions) {
    printFunction(writer, level, f)
  }

  writer.line(level, 'end_module')
}

export function printProgram(ast: ProgramNode): string {
  const moduleTexts = ast.modules.map((mod) => {
    const writer = new IndentWriter()
    printModule(writer, 0, mod)
    return writer.toString()
  })
  let text = moduleTexts.join(';\n')
  if (ast.trailingDot) text += '.'
  return text
}

export function format(source: string, parseFn: (s: string) => { ast: ProgramNode | null }): string {
  const { ast } = parseFn(source)
  if (!ast || ast.type !== 'program') return source
  return printProgram(ast)
}
