/**
 * Agile-SOFL AST node definitions.
 * Discriminated union with span on every node for editor/LSP support.
 */

import type { Span } from './span'

export interface WithSpan {
  span: Span
}

/** Text payload with source span (e.g. process comment/decomposition). */
export interface TextWithSpan {
  text: string
  span: Span
}

export type MaybeTextWithSpan = string | TextWithSpan

export function textOf(value: MaybeTextWithSpan | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value.text
}

// --- Program & Module ---

export interface ProgramNode extends WithSpan {
  type: 'program'
  modules: ModuleNode[]
  trailingDot?: boolean
}

export interface ModuleNode extends WithSpan {
  type: 'module'
  name: string
  /** Span of module name identifier (excludes SYSTEM_ prefix). */
  nameSpan?: Span
  /** Span of SYSTEM_ prefix token on system modules. */
  systemPrefixSpan?: Span
  isSystem: boolean
  parent?: QualifiedNameNode
  consts: ConstDeclNode[]
  types: TypeDeclNode[]
  vars: VarDeclNode[]
  invariants: InvariantNode[]
  processes: ProcessNode[]
  functions: FunctionNode[]
  gui?: GuiBlockNode
}

export interface GuiWidgetNode extends WithSpan {
  type: 'gui_widget'
  kind: 'label' | 'button' | 'text-input' | 'navigation'
  name: string
  text: string
  triggersProcess?: string
}

export interface GuiScreenNode extends WithSpan {
  type: 'gui_screen'
  name: string
  widgets: GuiWidgetNode[]
}

export interface GuiBlockNode extends WithSpan {
  type: 'gui_block'
  name: string
  screens: GuiScreenNode[]
}

export interface QualifiedNameNode extends WithSpan {
  type: 'qualified_name'
  module?: string
  name: string
}

export interface ConstDeclNode extends WithSpan {
  type: 'const_decl'
  name: string
  value: ExpressionNode
}

export interface TypeDeclNode extends WithSpan {
  type: 'type_decl'
  name: string
  parentType?: QualifiedNameNode
  typeExpr: TypeExprNode
}

export interface VarDeclNode extends WithSpan {
  type: 'var_decl'
  variable: VariableNode
  typeExpr: TypeExprNode
}

export interface VariableNode extends WithSpan {
  type: 'variable'
  kind: 'normal' | 'ext' | 'ext_hash'
  name: string
}

export interface InvariantNode extends WithSpan {
  type: 'invariant'
  condition: PredicateNode
}

// --- Process & Function ---

export interface ParamGroupNode extends WithSpan {
  type: 'param_group'
  names: string[]
  /** Per-name spans parallel to names[]; optional for backward compatibility. */
  nameSpans?: Array<{ name: string; span: Span }>
  typeExpr: TypeExprNode
}

export interface ProcessNode extends WithSpan {
  type: 'process'
  name: string
  /** Span of process name (or Init keyword). */
  nameSpan?: Span
  isInit: boolean
  inputs: ParamGroupNode[]
  outputs: ParamGroupNode[]
  body?: ProcessBodyNode
  alias?: QualifiedNameNode
}

export interface ProcessBodyNode extends WithSpan {
  type: 'process_body'
  ext: ExtVarNode[]
  fsf?: FsfSpecNode
  decomposition?: MaybeTextWithSpan
  comment?: MaybeTextWithSpan
}

export interface ExtVarNode extends WithSpan {
  type: 'ext_var'
  access: 'rd' | 'wr'
  name: string
  typeExpr?: TypeExprNode
}

export interface FunctionNode extends WithSpan {
  type: 'function'
  name: string
  /** Span of function name identifier. */
  nameSpan?: Span
  params: ParamGroupNode[]
  returnType: TypeExprNode
  fsf?: FsfSpecNode
  body?: ExpressionNode
  isUndefined: boolean
}

// --- FSF ---

export interface FsfSpecNode extends WithSpan {
  type: 'fsf_spec'
  scenarios: FsfScenarioNode[]
  others?: PredicateNode
}

export interface FsfScenarioNode extends WithSpan {
  type: 'fsf_scenario'
  test: PredicateNode
  def: PredicateNode
}

// --- Predicates (DNF) ---

export interface PredicateNode extends WithSpan {
  type: 'predicate'
  disjuncts: ConjunctionNode[]
}

export interface ConjunctionNode extends WithSpan {
  type: 'conjunction'
  atoms: AtomicPredicateNode[]
}

export type AtomicPredicateNode =
  | InformalTextNode
  | BooleanLiteralNode
  | ExpressionNode
  | RelationalExprNode
  | QuantifiedNode
  | NotPredicateNode
  | ParenPredicateNode

export interface InformalTextNode extends WithSpan {
  type: 'informal_text'
  text: string
}

export interface NotPredicateNode extends WithSpan {
  type: 'not_predicate'
  operand: AtomicPredicateNode
}

export interface ParenPredicateNode extends WithSpan {
  type: 'paren_predicate'
  inner: AtomicPredicateNode
}

export interface QuantifiedNode extends WithSpan {
  type: 'quantified'
  quantifier: 'forall' | 'exists' | 'exists_unique'
  bindings: BindingGroupNode[]
  nestedQuantifiers: QuantifiedNode[]
  body: PredicateNode
}

export interface BindingGroupNode extends WithSpan {
  type: 'binding_group'
  names: string[]
  typeExpr: TypeExprNode
}

// --- Types ---

export type TypeExprNode =
  | BasicTypeNode
  | NamedTypeNode
  | EnumTypeNode
  | SetTypeNode
  | SeqTypeNode
  | ComposedTypeNode
  | ProductTypeNode
  | MapTypeNode
  | UnionTypeNode

export interface BasicTypeNode extends WithSpan {
  type: 'basic_type'
  name: 'nat0' | 'nat' | 'int' | 'real' | 'char' | 'string' | 'bool' | 'given'
}

export interface NamedTypeNode extends WithSpan {
  type: 'named_type'
  qualified: QualifiedNameNode
}

export interface EnumTypeNode extends WithSpan {
  type: 'enum_type'
  values: string[]
}

export interface SetTypeNode extends WithSpan {
  type: 'set_type'
  element: TypeExprNode
}

export interface SeqTypeNode extends WithSpan {
  type: 'seq_type'
  element: TypeExprNode
}

export interface ComposedTypeNode extends WithSpan {
  type: 'composed_type'
  fields: FieldDeclNode[]
}

export interface FieldDeclNode extends WithSpan {
  type: 'field_decl'
  name: string
  typeExpr: TypeExprNode
}

export interface ProductTypeNode extends WithSpan {
  type: 'product_type'
  elements: TypeExprNode[]
}

export interface MapTypeNode extends WithSpan {
  type: 'map_type'
  domain: TypeExprNode
  range: TypeExprNode
}

export interface UnionTypeNode extends WithSpan {
  type: 'union_type'
  variants: TypeExprNode[]
  isUniversal?: boolean
}

// --- Expressions ---

export type ExpressionNode =
  | NilNode
  | BooleanLiteralNode
  | NumberLiteralNode
  | CharLiteralNode
  | StringLiteralNode
  | EnumLiteralNode
  | IdentifierNode
  | UnaryMinusNode
  | BinaryOpNode
  | CallNode
  | FieldAccessNode
  | IndexAccessNode
  | IfExprNode
  | LetExprNode
  | CaseExprNode
  | SetExprNode
  | SeqExprNode
  | MapExprNode
  | MkExprNode
  | ModifyExprNode
  | ParenExprNode
  | RelationalExprNode

export interface NilNode extends WithSpan {
  type: 'nil'
}

export interface BooleanLiteralNode extends WithSpan {
  type: 'boolean_literal'
  value: boolean
}

export interface NumberLiteralNode extends WithSpan {
  type: 'number_literal'
  value: number
  isReal: boolean
}

export interface CharLiteralNode extends WithSpan {
  type: 'char_literal'
  value: string
}

export interface StringLiteralNode extends WithSpan {
  type: 'string_literal'
  value: string
}

export interface EnumLiteralNode extends WithSpan {
  type: 'enum_literal'
  value: string
}

export interface IdentifierNode extends WithSpan {
  type: 'identifier'
  name: string
  qualified?: QualifiedNameNode
  negated?: boolean
}

export interface UnaryMinusNode extends WithSpan {
  type: 'unary_minus'
  operand: ExpressionNode
}

export interface BinaryOpNode extends WithSpan {
  type: 'binary_op'
  op: '+' | '-' | '*' | '/' | 'div' | 'rem' | 'mod' | '**'
  left: ExpressionNode
  right: ExpressionNode
}

export interface CallNode extends WithSpan {
  type: 'call'
  callee: string | ExpressionNode
  args: ExpressionNode[]
}

export interface FieldAccessNode extends WithSpan {
  type: 'field_access'
  object: ExpressionNode
  field: string
}

export interface IndexAccessNode extends WithSpan {
  type: 'index_access'
  object: ExpressionNode
  index: ExpressionNode
}

export interface IfExprNode extends WithSpan {
  type: 'if_expr'
  condition: PredicateNode
  thenExpr: ExpressionNode
  elseExpr: ExpressionNode
}

export interface LetExprNode extends WithSpan {
  type: 'let_expr'
  bindings: LetBindingNode[]
  body: ExpressionNode
}

export interface LetBindingNode extends WithSpan {
  type: 'let_binding'
  kind: 'equal' | 'typed'
  names: string[]
  typeExpr?: TypeExprNode
  guard?: PredicateNode
  value?: ExpressionNode
}

export interface CaseExprNode extends WithSpan {
  type: 'case_expr'
  scrutinee: ExpressionNode
  alternatives: CaseAltNode[]
  default?: ExpressionNode
}

export interface CaseAltNode extends WithSpan {
  type: 'case_alt'
  patterns: string[]
  expr: ExpressionNode
}

export interface SetExprNode extends WithSpan {
  type: 'set_expr'
  kind: 'empty' | 'list' | 'range' | 'comprehension'
  elements?: ExpressionNode[]
  rangeLow?: ExpressionNode
  rangeHigh?: ExpressionNode
  compExpr?: ExpressionNode
  compBindings?: BindingGroupNode[]
  compGuard?: PredicateNode
}

export interface SeqExprNode extends WithSpan {
  type: 'seq_expr'
  kind: 'empty' | 'list' | 'range' | 'comprehension' | 'string'
  elements?: ExpressionNode[]
  rangeLow?: ExpressionNode
  rangeHigh?: ExpressionNode
  compExpr?: ExpressionNode
  compBindings?: BindingGroupNode[]
  compGuard?: PredicateNode
  stringValue?: string
}

export interface MapExprNode extends WithSpan {
  type: 'map_expr'
  kind: 'empty' | 'pairs' | 'comprehension'
  pairs?: { key: ExpressionNode; value: ExpressionNode }[]
  compKey?: ExpressionNode
  compValue?: ExpressionNode
  compBindings?: BindingGroupNode[]
  compGuard?: PredicateNode
}

export interface MkExprNode extends WithSpan {
  type: 'mk_expr'
  typeName: QualifiedNameNode
  args: ExpressionNode[]
}

export interface ModifyExprNode extends WithSpan {
  type: 'modify_expr'
  target: ExpressionNode
  isProduct: boolean
  fields: { field: string | number; value: ExpressionNode }[]
}

export interface ParenExprNode extends WithSpan {
  type: 'paren_expr'
  inner: ExpressionNode
}

export interface RelationalExprNode extends WithSpan {
  type: 'relational_expr'
  kind:
    | 'eq'
    | 'neq'
    | 'lt'
    | 'le'
    | 'gt'
    | 'ge'
    | 'chain_lt'
    | 'chain_gt'
    | 'inset'
    | 'notin'
  left: ExpressionNode
  right: ExpressionNode
  chainMid?: ExpressionNode
  chainHigh?: ExpressionNode
}

export type AST = ProgramNode
