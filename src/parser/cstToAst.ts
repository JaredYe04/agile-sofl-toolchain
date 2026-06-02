/**
 * Convert Chevrotain CST to Agile-SOFL AST with source spans.
 */

import type { CstNode, IToken } from 'chevrotain'
import type {
  ProgramNode,
  ModuleNode,
  ConstDeclNode,
  TypeDeclNode,
  VarDeclNode,
  VariableNode,
  InvariantNode,
  ProcessNode,
  ProcessBodyNode,
  FunctionNode,
  ParamGroupNode,
  ExtVarNode,
  FsfSpecNode,
  FsfScenarioNode,
  PredicateNode,
  ConjunctionNode,
  AtomicPredicateNode,
  QualifiedNameNode,
  TypeExprNode,
  ExpressionNode,
  BindingGroupNode,
  QuantifiedNode,
  LetBindingNode
} from '../ast/nodes.js'
import { spanFromToken, mergeSpans, EMPTY_SPAN } from '../ast/span.js'

function spanOf(node: CstNode | IToken | undefined): typeof EMPTY_SPAN {
  if (!node) return EMPTY_SPAN
  if ('image' in node && 'startOffset' in node) {
    const t = node as IToken
    return spanFromToken(
      t.startOffset ?? 0,
      t.endOffset ?? 0,
      t.startLine ?? 1,
      t.startColumn ?? 1
    )
  }
  const cst = node as CstNode
  const loc = cst.location
  if (loc) {
    return spanFromToken(
      loc.startOffset ?? 0,
      loc.endOffset ?? 0,
      loc.startLine ?? 1,
      loc.startColumn ?? 1
    )
  }
  return EMPTY_SPAN
}

function firstToken(node: CstNode): IToken | undefined {
  if (node.children) {
    for (const key of Object.keys(node.children)) {
      const child = node.children[key]
      if (Array.isArray(child) && child.length > 0) {
        const first = child[0]
        if (first && 'image' in first) return first as IToken
        if (first && 'children' in first) {
          const t = firstToken(first as CstNode)
          if (t) return t
        }
      }
    }
  }
  return undefined
}

function tokensOf(node: CstNode, ...names: string[]): IToken[] {
  const result: IToken[] = []
  for (const name of names) {
    const arr = node.children[name]
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && 'tokenType' in item) result.push(item as IToken)
      }
    }
  }
  return result
}

function allRuleInstances(node: CstNode, baseName: string): CstNode[] {
  const result: CstNode[] = []
  for (const [key, value] of Object.entries(node.children)) {
    if (key !== baseName && !key.startsWith(baseName)) continue
    if (key.length > baseName.length) {
      const suffix = key.slice(baseName.length)
      if (suffix && !/^\d+$/.test(suffix)) continue
    }
    if (!Array.isArray(value)) continue
    for (const c of value) {
      if (c && typeof c === 'object' && 'name' in c) result.push(c as CstNode)
    }
  }
  return result
}

function childNodes(node: CstNode, name: string): CstNode[] {
  const arr = node.children[name]
  if (!Array.isArray(arr)) return []
  return arr.filter((c): c is CstNode => c !== undefined && 'name' in c)
}

function singleChild(node: CstNode, name: string): CstNode | undefined {
  return childNodes(node, name)[0]
}

export function cstToProgram(cst: CstNode): ProgramNode {
  const modulesCst = singleChild(cst, 'modules')
  const dot = tokensOf(cst, 'Dot')[0]
  return {
    type: 'program',
    span: spanOf(cst),
    modules: modulesCst ? cstToModules(modulesCst) : [],
    trailingDot: !!dot
  }
}

function cstToModules(cst: CstNode): ModuleNode[] {
  const modules: ModuleNode[] = []
  const top = singleChild(cst, 'topModule')
  if (top) modules.push(cstToTopModule(top))
  for (const m of childNodes(cst, 'module')) {
    modules.push(cstToRegularModule(m))
  }
  return modules
}

function cstToTopModule(cst: CstNode): ModuleNode {
  const id = tokensOf(cst, 'Identifier')[0]
  const body = singleChild(cst, 'moduleBody')
  return {
    type: 'module',
    span: spanOf(cst),
    name: id?.image ?? 'SYSTEM_',
    isSystem: true,
    consts: body ? extractConsts(body) : [],
    types: body ? extractTypes(body) : [],
    vars: body ? extractVars(body) : [],
    invariants: body ? extractInvs(body) : [],
    processes: body ? extractProcesses(body) : [],
    functions: body ? extractFunctions(body) : []
  }
}

function cstToRegularModule(cst: CstNode): ModuleNode {
  const ids = tokensOf(cst, 'Identifier')
  const body = singleChild(cst, 'moduleBody')
  const parent = ids.length > 1 ? ids[1] : undefined
  return {
    type: 'module',
    span: spanOf(cst),
    name: ids[0]?.image ?? '',
    isSystem: false,
    parent: parent
      ? { type: 'qualified_name', span: spanOf(parent), name: parent.image }
      : undefined,
    consts: body ? extractConsts(body) : [],
    types: body ? extractTypes(body) : [],
    vars: body ? extractVars(body) : [],
    invariants: body ? extractInvs(body) : [],
    processes: body ? extractProcesses(body) : [],
    functions: body ? extractFunctions(body) : []
  }
}

function extractConsts(body: CstNode): ConstDeclNode[] {
  const decls = childNodes(body, 'constDecls')
  const result: ConstDeclNode[] = []
  for (const d of decls) {
    for (const item of allRuleInstances(d, 'constItem')) {
      const id = tokensOf(item, 'Identifier')[0]
      const constant = singleChild(item, 'constant')
      result.push({
        type: 'const_decl',
        span: spanOf(item),
        name: id?.image ?? '',
        value: constant ? cstToConstant(constant) : { type: 'nil', span: EMPTY_SPAN }
      })
    }
  }
  return result
}

function extractTypes(body: CstNode): TypeDeclNode[] {
  const result: TypeDeclNode[] = []
  for (const d of childNodes(body, 'typeDecls')) {
    for (const item of allRuleInstances(d, 'typeItem')) {
      const id = tokensOf(item, 'Identifier')[0]
      const parentAccess = singleChild(item, 'moduleOrFieldAccess')
      const typeExpr = singleChild(item, 'typeExpr')
      result.push({
        type: 'type_decl',
        span: spanOf(item),
        name: id?.image ?? '',
        parentType: parentAccess ? cstToQualifiedName(parentAccess) : undefined,
        typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
      })
    }
  }
  return result
}

function extractVars(body: CstNode): VarDeclNode[] {
  const result: VarDeclNode[] = []
  for (const d of childNodes(body, 'varDecls')) {
    for (const item of allRuleInstances(d, 'varItem')) {
      const variable = singleChild(item, 'variable')
      const typeExpr = singleChild(item, 'typeExpr')
      result.push({
        type: 'var_decl',
        span: spanOf(item),
        variable: variable ? cstToVariable(variable) : { type: 'variable', span: EMPTY_SPAN, kind: 'normal', name: '' },
        typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
      })
    }
  }
  return result
}

function cstToVariable(cst: CstNode): VariableNode {
  const ext = tokensOf(cst, 'Ext')
  const hash = tokensOf(cst, 'Hash')
  const id = tokensOf(cst, 'Identifier')[0]
  if (ext.length > 0 && hash.length > 0) {
    return { type: 'variable', span: spanOf(cst), kind: 'ext_hash', name: id?.image ?? '' }
  }
  if (ext.length > 0) {
    return { type: 'variable', span: spanOf(cst), kind: 'ext', name: id?.image ?? '' }
  }
  return { type: 'variable', span: spanOf(cst), kind: 'normal', name: id?.image ?? '' }
}

function extractInvs(body: CstNode): InvariantNode[] {
  const result: InvariantNode[] = []
  for (const d of childNodes(body, 'invDecls')) {
    for (const p of allRuleInstances(d, 'predicate')) {
      result.push({ type: 'invariant', span: spanOf(p), condition: cstToPredicate(p) })
    }
  }
  return result
}

function extractProcesses(body: CstNode): ProcessNode[] {
  const specs = singleChild(body, 'processFunctionSpecs')
  if (!specs) return []
  return allRuleInstances(specs, 'processDef').map(cstToProcess)
}

function extractFunctions(body: CstNode): FunctionNode[] {
  const specs = singleChild(body, 'processFunctionSpecs')
  if (!specs) return []
  return allRuleInstances(specs, 'functionDef').map(cstToFunction)
}

function cstToProcess(cst: CstNode): ProcessNode {
  const equal = tokensOf(cst, 'Equal')
  if (equal.length > 0) {
    const id = tokensOf(cst, 'Identifier')[0]
    const alias = singleChild(cst, 'moduleOrFieldAccess')
    return {
      type: 'process',
      span: spanOf(cst),
      name: id?.image ?? '',
      isInit: false,
      inputs: [],
      outputs: [],
      alias: alias ? cstToQualifiedName(alias) : undefined
    }
  }

  const init = tokensOf(cst, 'Init')
  const ids = tokensOf(cst, 'Identifier')
  const paramDecls = childNodes(cst, 'paramDecls')
  const body = singleChild(cst, 'processBody')

  return {
    type: 'process',
    span: spanOf(cst),
    name: init.length > 0 ? 'Init' : (ids[0]?.image ?? ''),
    isInit: init.length > 0,
    inputs: paramDecls[0] ? cstToParamDecls(paramDecls[0]) : [],
    outputs: paramDecls[1] ? cstToParamDecls(paramDecls[1]) : [],
    body: body ? cstToProcessBody(body) : undefined
  }
}

function cstToParamDecls(cst: CstNode): ParamGroupNode[] {
  return childNodes(cst, 'paramGroup').map((g) => {
    const ids = tokensOf(g, 'Identifier')
    const typeExpr = singleChild(g, 'typeExpr')
    return {
      type: 'param_group',
      span: spanOf(g),
      names: ids.map((t) => t.image),
      typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
    }
  })
}

function cstToProcessBody(cst: CstNode): ProcessBodyNode {
  const extVars = singleChild(cst, 'extVars')
  const fsfSpec = singleChild(cst, 'fsfSpec')
  const decomId = tokensOf(cst, 'Identifier')
  const commentText = singleChild(cst, 'text')
  return {
    type: 'process_body',
    span: spanOf(cst),
    ext: extVars ? cstToExtVars(extVars) : [],
    fsf: fsfSpec ? cstToFsfSpec(fsfSpec) : undefined,
    decomposition: decomId[0]?.image,
    comment: commentText ? cstToText(commentText) : undefined
  }
}

function cstToExtVars(cst: CstNode): ExtVarNode[] {
  return childNodes(cst, 'extVar').map((ev) => {
    const rd = tokensOf(ev, 'Rd')
    const id = tokensOf(ev, 'Identifier')[0]
    const typeExpr = singleChild(ev, 'typeExpr')
    return {
      type: 'ext_var',
      span: spanOf(ev),
      access: rd.length > 0 ? 'rd' : 'wr',
      name: id?.image ?? '',
      typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : undefined
    }
  })
}

function cstToFsfSpec(cst: CstNode): FsfSpecNode {
  const othersTokens = tokensOf(cst, 'Others')
  const fsfExpr = singleChild(cst, 'fsfExpression')
  const predicates = childNodes(cst, 'predicate')

  if (othersTokens.length > 0 && !fsfExpr) {
    return {
      type: 'fsf_spec',
      span: spanOf(cst),
      scenarios: [],
      others: predicates[0] ? cstToPredicate(predicates[0]) : undefined
    }
  }

  const scenarios: FsfScenarioNode[] = fsfExpr
    ? allRuleInstances(fsfExpr, 'fsfScenario').map((s) => {
        const preds = allRuleInstances(s, 'predicate')
        return {
          type: 'fsf_scenario',
          span: spanOf(s),
          test: preds[0] ? cstToPredicate(preds[0]) : { type: 'predicate', span: EMPTY_SPAN, disjuncts: [] },
          def: preds[1] ? cstToPredicate(preds[1]) : { type: 'predicate', span: EMPTY_SPAN, disjuncts: [] }
        }
      })
    : []

  const othersPred = predicates.length > 0 ? predicates[predicates.length - 1] : undefined
  return {
    type: 'fsf_spec',
    span: spanOf(cst),
    scenarios,
    others: othersPred && othersTokens.length > 0 ? cstToPredicate(othersPred) : undefined
  }
}

function cstToFunction(cst: CstNode): FunctionNode {
  const id = tokensOf(cst, 'Identifier')[0]
  const paramDecls = singleChild(cst, 'paramDecls')
  const typeExpr = singleChild(cst, 'typeExpr')
  const fsfSpec = singleChild(cst, 'fsfSpec')
  const undefinedTok = tokensOf(cst, 'Undefined')
  const expr = singleChild(cst, 'expression')
  return {
    type: 'function',
    span: spanOf(cst),
    name: id?.image ?? '',
    params: paramDecls ? cstToParamDecls(paramDecls) : [],
    returnType: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' },
    fsf: fsfSpec ? cstToFsfSpec(fsfSpec) : undefined,
    body: expr ? cstToExpression(expr) : undefined,
    isUndefined: undefinedTok.length > 0
  }
}

function cstToQualifiedName(cst: CstNode): QualifiedNameNode {
  const ids = tokensOf(cst, 'Identifier')
  if (ids.length >= 2) {
    return {
      type: 'qualified_name',
      span: spanOf(cst),
      module: ids[0].image,
      name: ids[1].image
    }
  }
  return { type: 'qualified_name', span: spanOf(cst), name: ids[0]?.image ?? '' }
}

function cstToTypeExpr(cst: CstNode): TypeExprNode {
  const product = singleChild(cst, 'productType')
  if (product) {
    const elements = childNodes(product, 'typeAtomic').map(cstToTypeAtomic)
    return { type: 'product_type', span: spanOf(cst), elements }
  }
  const union = singleChild(cst, 'unionType')
  if (union) {
    const universal = tokensOf(union, 'Universal')
    if (universal.length > 0) {
      return { type: 'union_type', span: spanOf(cst), variants: [], isUniversal: true }
    }
    const variants = childNodes(union, 'typeAtomic').map(cstToTypeAtomic)
    return { type: 'union_type', span: spanOf(cst), variants }
  }
  const atomic = singleChild(cst, 'typeAtomic')
  if (atomic) return cstToTypeAtomic(atomic)
  const primary = singleChild(cst, 'typePrimary')
  if (primary) return cstToTypeAtomic(primary)
  const other = singleChild(cst, 'otherType')
  if (other) return cstToTypeExpr(other)
  const access = singleChild(cst, 'moduleOrFieldAccess')
  if (access) {
    return { type: 'named_type', span: spanOf(cst), qualified: cstToQualifiedName(access) }
  }
  return { type: 'basic_type', span: spanOf(cst), name: 'given' }
}

function cstToTypeAtomic(cst: CstNode): TypeExprNode {
  const basic = singleChild(cst, 'basicType')
  if (basic) {
    const tok = firstToken(basic)
    const name = (tok?.image ?? 'given') as 'nat0' | 'nat' | 'int' | 'real' | 'char' | 'string' | 'bool' | 'given'
    return { type: 'basic_type', span: spanOf(cst), name }
  }
  const enumT = singleChild(cst, 'enumType')
  if (enumT) {
    const values = tokensOf(enumT, 'EnumValue').map((t) => t.image.slice(1, -1))
    return { type: 'enum_type', span: spanOf(cst), values }
  }
  const setT = singleChild(cst, 'setType')
  if (setT) {
    const inner = singleChild(setT, 'typeExpr')
    return { type: 'set_type', span: spanOf(cst), element: inner ? cstToTypeExpr(inner) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' } }
  }
  const seqT = singleChild(cst, 'seqType')
  if (seqT) {
    const inner = singleChild(seqT, 'typeExpr')
    return { type: 'seq_type', span: spanOf(cst), element: inner ? cstToTypeExpr(inner) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' } }
  }
  const composed = singleChild(cst, 'composedType')
  if (composed) {
    const fields = singleChild(composed, 'fieldList')
    return {
      type: 'composed_type',
      span: spanOf(cst),
      fields: fields ? cstToFieldList(fields) : []
    }
  }
  const mapT = singleChild(cst, 'mapType')
  if (mapT) {
    const types = childNodes(mapT, 'typeExpr')
    return {
      type: 'map_type',
      span: spanOf(cst),
      domain: types[0] ? cstToTypeExpr(types[0]) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' },
      range: types[1] ? cstToTypeExpr(types[1]) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
    }
  }
  return { type: 'basic_type', span: spanOf(cst), name: 'given' }
}

function cstToFieldList(cst: CstNode): { type: 'field_decl'; span: typeof EMPTY_SPAN; name: string; typeExpr: TypeExprNode }[] {
  return childNodes(cst, 'fieldDecl').map((fd) => {
    const id = tokensOf(fd, 'Identifier')[0]
    const typeExpr = singleChild(fd, 'typeExpr')
    return {
      type: 'field_decl' as const,
      span: spanOf(fd),
      name: id?.image ?? '',
      typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
    }
  })
}

function cstToPredicate(cst: CstNode): PredicateNode {
  const conjunctions = childNodes(cst, 'conjunction')
  return {
    type: 'predicate',
    span: spanOf(cst),
    disjuncts: conjunctions.map(cstToConjunction)
  }
}

function cstToConjunction(cst: CstNode): ConjunctionNode {
  const atoms = childNodes(cst, 'atomicPredicate')
  return {
    type: 'conjunction',
    span: spanOf(cst),
    atoms: atoms.map(cstToAtomicPredicate)
  }
}

function cstToAtomicPredicate(cst: CstNode): AtomicPredicateNode {
  const notTok = tokensOf(cst, 'Not')
  if (notTok.length > 0) {
    const inner = childNodes(cst, 'atomicPredicate')[0]
    return {
      type: 'not_predicate',
      span: spanOf(cst),
      operand: inner ? cstToAtomicPredicate(inner) : { type: 'informal_text', span: EMPTY_SPAN, text: '' }
    }
  }
  const text = singleChild(cst, 'text')
  if (text) return { type: 'informal_text', span: spanOf(cst), text: cstToText(text) }
  const boolVal = singleChild(cst, 'booleanValue')
  if (boolVal) {
    const t = tokensOf(boolVal, 'True')
    return { type: 'boolean_literal', span: spanOf(cst), value: t.length > 0 }
  }
  const quant = singleChild(cst, 'quantified')
  if (quant) return cstToQuantified(quant)
  const rel = singleChild(cst, 'relationalExpr')
  if (rel) return cstToRelationalExpr(rel)
  const expr = singleChild(cst, 'expression')
  if (expr) return cstToExpression(expr)
  const boolApply = singleChild(cst, 'booleanApply')
  if (boolApply) {
    const name = firstToken(boolApply)?.image ?? 'bound'
    const args = childNodes(boolApply, 'setExpr').length > 0
      ? childNodes(boolApply, 'setExpr').map(cstToSetExpr)
      : childNodes(boolApply, 'expression').map(cstToExpression)
    return {
      type: 'call',
      span: spanOf(cst),
      callee: name,
      args
    }
  }
  const inner = childNodes(cst, 'atomicPredicate')[0]
  if (inner) return { type: 'paren_predicate', span: spanOf(cst), inner: cstToAtomicPredicate(inner) }
  return { type: 'informal_text', span: spanOf(cst), text: '' }
}

function cstToQuantified(cst: CstNode): QuantifiedNode {
  const forall = tokensOf(cst, 'Forall')
  const exists = tokensOf(cst, 'Exists')
  const notTok = tokensOf(cst, 'Not')
  const bindingList = singleChild(cst, 'bindingList')
  const predicate = singleChild(cst, 'predicate')
  return {
    type: 'quantified',
    span: spanOf(cst),
    quantifier: forall.length > 0 ? 'forall' : notTok.length > 0 && exists.length > 0 ? 'exists_unique' : 'exists',
    bindings: bindingList ? cstToBindingList(bindingList) : [],
    nestedQuantifiers: childNodes(cst, 'quantifierList').map((q) => cstToQuantifiedFromList(q)),
    body: predicate ? cstToPredicate(predicate) : { type: 'predicate', span: EMPTY_SPAN, disjuncts: [] }
  }
}

function cstToQuantifiedFromList(cst: CstNode): QuantifiedNode {
  const forall = tokensOf(cst, 'Forall')
  const bindingList = singleChild(cst, 'bindingList')
  return {
    type: 'quantified',
    span: spanOf(cst),
    quantifier: forall.length > 0 ? 'forall' : 'exists',
    bindings: bindingList ? cstToBindingList(bindingList) : [],
    nestedQuantifiers: [],
    body: { type: 'predicate', span: EMPTY_SPAN, disjuncts: [] }
  }
}

function cstToBindingList(cst: CstNode): BindingGroupNode[] {
  return childNodes(cst, 'bindingGroup').map((g) => {
    const ids = tokensOf(g, 'Identifier')
    const typeExpr = singleChild(g, 'typeExpr')
    return {
      type: 'binding_group',
      span: spanOf(g),
      names: ids.map((t) => t.image),
      typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : { type: 'basic_type', span: EMPTY_SPAN, name: 'given' }
    }
  })
}

function cstToText(cst: CstNode): string {
  const parts: string[] = []
  for (const str of tokensOf(cst, 'StringLiteral')) {
    parts.push(str.image.slice(1, -1))
  }
  for (const id of tokensOf(cst, 'Identifier')) {
    parts.push(id.image)
  }
  return parts.join(' ')
}

function cstToConstant(cst: CstNode): ExpressionNode {
  const nil = tokensOf(cst, 'Nil')
  if (nil.length > 0) return { type: 'nil', span: spanOf(cst) }
  const boolVal = singleChild(cst, 'booleanValue')
  if (boolVal) {
    return { type: 'boolean_literal', span: spanOf(cst), value: tokensOf(boolVal, 'True').length > 0 }
  }
  const num = singleChild(cst, 'number')
  if (num) return cstToNumber(num)
  const numberExpr = singleChild(cst, 'numberExpr')
  if (numberExpr) return cstToNumberExpr(numberExpr)
  const char = singleChild(cst, 'charValue')
  if (char) {
    const t = tokensOf(char, 'CharLiteral')[0]
    return { type: 'char_literal', span: spanOf(cst), value: t?.image.slice(1, -1) ?? '' }
  }
  const enumV = tokensOf(cst, 'EnumValue')[0]
  if (enumV) return { type: 'enum_literal', span: spanOf(cst), value: enumV.image.slice(1, -1) }
  const access = singleChild(cst, 'moduleOrFieldAccess')
  if (access) {
    const q = cstToQualifiedName(access)
    return { type: 'identifier', span: spanOf(cst), name: q.name, qualified: q.module ? q : undefined }
  }
  const setC = singleChild(cst, 'setConstant')
  if (setC) return cstToSetExprFromConstant(setC)
  const seqC = singleChild(cst, 'seqConstant')
  if (seqC) return cstToSeqFromConstant(seqC)
  const mapC = singleChild(cst, 'mapConstant')
  if (mapC) return cstToMapFromConstant(mapC)
  const mk = singleChild(cst, 'mkConstant')
  if (mk) {
    const access2 = singleChild(mk, 'moduleOrFieldAccess')
    const list = singleChild(mk, 'constantList')
    return {
      type: 'mk_expr',
      span: spanOf(cst),
      typeName: access2 ? cstToQualifiedName(access2) : { type: 'qualified_name', span: EMPTY_SPAN, name: '' },
      args: list ? childNodes(list, 'constant').map(cstToConstant) : []
    }
  }
  return { type: 'nil', span: spanOf(cst) }
}

function cstToNumber(cst: CstNode): ExpressionNode {
  const real = tokensOf(cst, 'RealLiteral')[0]
  const int = tokensOf(cst, 'IntegerLiteral')[0]
  if (real) return { type: 'number_literal', span: spanOf(cst), value: parseFloat(real.image), isReal: true }
  if (int) return { type: 'number_literal', span: spanOf(cst), value: parseInt(int.image, 10), isReal: false }
  return { type: 'number_literal', span: spanOf(cst), value: 0, isReal: false }
}

function cstToExpression(cst: CstNode): ExpressionNode {
  const num = singleChild(cst, 'numberExpr')
  if (num) return cstToNumberExpr(num)
  const char = singleChild(cst, 'charExpr')
  if (char) {
    const cv = singleChild(char, 'charValue')
    if (cv) {
      const t = tokensOf(cv, 'CharLiteral')[0]
      return { type: 'char_literal', span: spanOf(cst), value: t?.image.slice(1, -1) ?? '' }
    }
  }
  const enumV = tokensOf(cst, 'EnumValue')[0]
  if (enumV) return { type: 'enum_literal', span: spanOf(cst), value: enumV.image.slice(1, -1) }
  const set = singleChild(cst, 'setExpr')
  if (set) return cstToSetExpr(set)
  const seq = singleChild(cst, 'seqExpr')
  if (seq) return cstToSeqExpr(seq)
  const map = singleChild(cst, 'mapExpr')
  if (map) return cstToMapExpr(map)
  const composite = singleChild(cst, 'compositeExpr')
  if (composite) return cstToCompositeExpr(composite)
  const product = singleChild(cst, 'productExpr')
  if (product) return cstToProductExpr(product)
  const cop = singleChild(cst, 'compositeOrProductExpr')
  if (cop) return cstToCompositeOrProduct(cop)
  const general = singleChild(cst, 'generalExpr')
  if (general) return cstToGeneralExpr(general)
  const inner = childNodes(cst, 'expression')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToExpression(inner) }
  return { type: 'nil', span: spanOf(cst) }
}

function cstToNumberExpr(cst: CstNode): ExpressionNode {
  const parts = childNodes(cst, 'subNumber1')
  if (parts.length === 0) return { type: 'number_literal', span: spanOf(cst), value: 0, isReal: false }
  let result = cstToSubNumber1(parts[0])
  for (let i = 1; i < parts.length; i++) {
    const plus = tokensOf(cst, 'Plus')
    const op = plus.length >= i ? '+' : '-'
    result = {
      type: 'binary_op',
      span: mergeSpans(result.span, parts[i] ? spanOf(parts[i]) : EMPTY_SPAN),
      op: op as '+' | '-',
      left: result,
      right: cstToSubNumber1(parts[i])
    }
  }
  return result
}

function cstToSubNumber1(cst: CstNode): ExpressionNode {
  const parts = childNodes(cst, 'subNumber2')
  if (parts.length === 0) return cstToSubNumber3(childNodes(cst, 'subNumber3')[0] ?? cst)
  let result = cstToSubNumber2(parts[0])
  const ops: Array<'*' | '/' | 'div' | 'rem' | 'mod'> = ['*', '/', 'div', 'rem', 'mod']
  for (let i = 1; i < parts.length; i++) {
    let op: typeof ops[number] = '*'
    if (tokensOf(cst, 'Slash').length >= i) op = '/'
    else if (tokensOf(cst, 'Div').length >= i) op = 'div'
    else if (tokensOf(cst, 'Rem').length >= i) op = 'rem'
    else if (tokensOf(cst, 'Mod').length >= i) op = 'mod'
    result = { type: 'binary_op', span: spanOf(cst), op, left: result, right: cstToSubNumber2(parts[i]) }
  }
  return result
}

function cstToSubNumber2(cst: CstNode): ExpressionNode {
  const parts = childNodes(cst, 'subNumber3')
  if (parts.length <= 1) return cstToSubNumber3(parts[0] ?? cst)
  let result = cstToSubNumber3(parts[0])
  for (let i = 1; i < parts.length; i++) {
    result = {
      type: 'binary_op',
      span: spanOf(cst),
      op: '**',
      left: result,
      right: cstToSubNumber3(parts[i])
    }
  }
  return result
}

function cstToSubNumber3(cst: CstNode): ExpressionNode {
  const num = singleChild(cst, 'number')
  if (num) return cstToNumber(num)
  const minus = tokensOf(cst, 'Minus')
  const numExpr = singleChild(cst, 'numberExpr')
  if (minus.length > 0 && numExpr) {
    return { type: 'unary_minus', span: spanOf(cst), operand: cstToNumberExpr(numExpr) }
  }
  const apply = singleChild(cst, 'numberApply')
  if (apply) {
    const name = firstToken(apply)?.image ?? 'abs'
    const args: ExpressionNode[] = []
    const ne = singleChild(apply, 'numberExpr')
    const se = singleChild(apply, 'setExpr')
    const sq = singleChild(apply, 'seqExpr')
    if (ne) args.push(cstToNumberExpr(ne))
    if (se) args.push(cstToSetExpr(se))
    if (sq) args.push(cstToSeqExpr(sq))
    return { type: 'call', span: spanOf(cst), callee: name, args }
  }
  const general = singleChild(cst, 'generalExpr')
  if (general) return cstToGeneralExpr(general)
  return { type: 'number_literal', span: spanOf(cst), value: 0, isReal: false }
}

function cstToSetExpr(cst: CstNode): ExpressionNode {
  const ctor = singleChild(cst, 'setConstructor')
  if (ctor) return cstToSetConstructor(ctor)
  const apply = singleChild(cst, 'setApply')
  if (apply) {
    const name = firstToken(apply)?.image ?? 'union'
    const args = [...childNodes(apply, 'setExpr').map(cstToSetExpr), ...childNodes(apply, 'seqExpr').map(cstToSeqExpr), ...childNodes(apply, 'mapExpr').map(cstToMapExpr)]
    return { type: 'call', span: spanOf(cst), callee: name, args }
  }
  const inner = childNodes(cst, 'setExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToSetExpr(inner) }
  return { type: 'set_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToSetConstructor(cst: CstNode): ExpressionNode {
  const rbrace = tokensOf(cst, 'RBrace')
  const list = singleChild(cst, 'expressionList')
  const ellipsis = tokensOf(cst, 'Ellipsis')
  const pipe = tokensOf(cst, 'Pipe')
  const amp = tokensOf(cst, 'Amp')
  if (list && !pipe.length) {
    return {
      type: 'set_expr',
      span: spanOf(cst),
      kind: 'list',
      elements: childNodes(list, 'expression').map(cstToExpression)
    }
  }
  if (ellipsis.length > 0) {
    const nums = childNodes(cst, 'numberExpr')
    return {
      type: 'set_expr',
      span: spanOf(cst),
      kind: 'range',
      rangeLow: nums[0] ? cstToNumberExpr(nums[0]) : undefined,
      rangeHigh: nums[1] ? cstToNumberExpr(nums[1]) : undefined
    }
  }
  if (pipe.length > 0 && amp.length > 0) {
    const exprs = childNodes(cst, 'expression')
    const bindings = singleChild(cst, 'bindingList')
    const pred = singleChild(cst, 'predicate')
    return {
      type: 'set_expr',
      span: spanOf(cst),
      kind: 'comprehension',
      compExpr: exprs[0] ? cstToExpression(exprs[0]) : undefined,
      compBindings: bindings ? cstToBindingList(bindings) : undefined,
      compGuard: pred ? cstToPredicate(pred) : undefined
    }
  }
  if (pipe.length > 0) {
    const exprs = childNodes(cst, 'expression')
    const pred = singleChild(cst, 'predicate')
    return {
      type: 'set_expr',
      span: spanOf(cst),
      kind: 'comprehension',
      compExpr: exprs[0] ? cstToExpression(exprs[0]) : undefined,
      compGuard: pred ? cstToPredicate(pred) : undefined
    }
  }
  return { type: 'set_expr', span: spanOf(cst), kind: rbrace.length ? 'empty' : 'list', elements: [] }
}

function cstToSetExprFromConstant(cst: CstNode): ExpressionNode {
  return cstToSetConstructor(cst)
}

function cstToSeqExpr(cst: CstNode): ExpressionNode {
  const str = singleChild(cst, 'stringValue')
  if (str) {
    const t = tokensOf(str, 'StringLiteral')[0]
    return { type: 'seq_expr', span: spanOf(cst), kind: 'string', stringValue: t?.image.slice(1, -1) ?? '' }
  }
  const ctor = singleChild(cst, 'seqConstructor')
  if (ctor) return cstToSeqConstructor(ctor)
  const apply = singleChild(cst, 'seqApply')
  if (apply) {
    const name = firstToken(apply)?.image ?? 'tl'
    const args = childNodes(apply, 'seqExpr').map(cstToSeqExpr)
    return { type: 'call', span: spanOf(cst), callee: name, args }
  }
  const inner = childNodes(cst, 'seqExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToSeqExpr(inner) }
  return { type: 'seq_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToSeqConstructor(cst: CstNode): ExpressionNode {
  const list = singleChild(cst, 'expressionList')
  const ellipsis = tokensOf(cst, 'Ellipsis')
  const pipe = tokensOf(cst, 'Pipe')
  if (list && !pipe.length) {
    return { type: 'seq_expr', span: spanOf(cst), kind: 'list', elements: childNodes(list, 'expression').map(cstToExpression) }
  }
  if (ellipsis.length > 0) {
    const nums = childNodes(cst, 'numberExpr')
    return {
      type: 'seq_expr',
      span: spanOf(cst),
      kind: 'range',
      rangeLow: nums[0] ? cstToNumberExpr(nums[0]) : undefined,
      rangeHigh: nums[1] ? cstToNumberExpr(nums[1]) : undefined
    }
  }
  if (pipe.length > 0) {
    const exprs = childNodes(cst, 'expression')
    const bindings = singleChild(cst, 'bindingList')
    const pred = singleChild(cst, 'predicate')
    return {
      type: 'seq_expr',
      span: spanOf(cst),
      kind: 'comprehension',
      compExpr: exprs[0] ? cstToExpression(exprs[0]) : undefined,
      compBindings: bindings ? cstToBindingList(bindings) : undefined,
      compGuard: pred ? cstToPredicate(pred) : undefined
    }
  }
  return { type: 'seq_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToSeqFromConstant(cst: CstNode): ExpressionNode {
  const str = singleChild(cst, 'stringValue')
  if (str) return cstToSeqExpr(cst)
  const ctor = singleChild(cst, 'seqConstructor')
  if (ctor) return cstToSeqConstructor(ctor)
  return { type: 'seq_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToMapExpr(cst: CstNode): ExpressionNode {
  const ctor = singleChild(cst, 'mapConstructor')
  if (ctor) return cstToMapConstructor(ctor)
  const apply = singleChild(cst, 'mapApply')
  if (apply) {
    const name = firstToken(apply)?.image ?? 'comp'
    const args = [...childNodes(apply, 'mapExpr').map(cstToMapExpr), ...childNodes(apply, 'setExpr').map(cstToSetExpr)]
    return { type: 'call', span: spanOf(cst), callee: name, args }
  }
  const inner = childNodes(cst, 'mapExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToMapExpr(inner) }
  return { type: 'map_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToMapConstructor(cst: CstNode): ExpressionNode {
  const arrowOnly = tokensOf(cst, 'Arrow').length === 1 && childNodes(cst, 'expression').length === 0
  if (arrowOnly) return { type: 'map_expr', span: spanOf(cst), kind: 'empty' }
  const exprs = childNodes(cst, 'expression')
  const pipe = tokensOf(cst, 'Pipe')
  if (pipe.length > 0 && exprs.length >= 2) {
    const bindings = singleChild(cst, 'bindingList')
    const pred = singleChild(cst, 'predicate')
    return {
      type: 'map_expr',
      span: spanOf(cst),
      kind: 'comprehension',
      compKey: cstToExpression(exprs[0]),
      compValue: cstToExpression(exprs[1]),
      compBindings: bindings ? cstToBindingList(bindings) : undefined,
      compGuard: pred ? cstToPredicate(pred) : undefined
    }
  }
  if (exprs.length >= 2) {
    const pairs: { key: ExpressionNode; value: ExpressionNode }[] = []
    for (let i = 0; i + 1 < exprs.length; i += 2) {
      pairs.push({ key: cstToExpression(exprs[i]), value: cstToExpression(exprs[i + 1]) })
    }
    if (exprs.length === 2) {
      pairs.length = 0
      pairs.push({ key: cstToExpression(exprs[0]), value: cstToExpression(exprs[1]) })
    }
    return { type: 'map_expr', span: spanOf(cst), kind: 'pairs', pairs }
  }
  return { type: 'map_expr', span: spanOf(cst), kind: 'empty' }
}

function cstToMapFromConstant(cst: CstNode): ExpressionNode {
  return cstToMapConstructor(cst)
}

function cstToCompositeOrProduct(cst: CstNode): ExpressionNode {
  const access = singleChild(cst, 'moduleOrFieldAccess')
  if (access) {
    const list = singleChild(cst, 'expressionList')
    return {
      type: 'mk_expr',
      span: spanOf(cst),
      typeName: cstToQualifiedName(access),
      args: list ? childNodes(list, 'expression').map(cstToExpression) : []
    }
  }
  const inner = childNodes(cst, 'compositeOrProductExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToCompositeOrProduct(inner) }
  return { type: 'nil', span: spanOf(cst) }
}

function cstToCompositeExpr(cst: CstNode): ExpressionNode {
  const apply = singleChild(cst, 'compositeApply')
  if (apply) return cstToModify(apply, false)
  const inner = childNodes(cst, 'compositeExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToCompositeExpr(inner) }
  return { type: 'nil', span: spanOf(cst) }
}

function cstToProductExpr(cst: CstNode): ExpressionNode {
  const apply = singleChild(cst, 'productApply')
  if (apply) return cstToModify(apply, true)
  const inner = childNodes(cst, 'productExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToProductExpr(inner) }
  return { type: 'nil', span: spanOf(cst) }
}

function cstToModify(cst: CstNode, isProduct: boolean): ExpressionNode {
  const target = singleChild(cst, 'expression')
  const fieldList = singleChild(cst, 'modifyingFieldList')
  const valueList = singleChild(cst, 'modifyingValueList')
  const fields: { field: string | number; value: ExpressionNode }[] = []
  if (fieldList) {
    const ids = tokensOf(fieldList, 'Identifier')
    const exprs = childNodes(fieldList, 'expression')
    ids.forEach((id, i) => fields.push({ field: id.image, value: exprs[i] ? cstToExpression(exprs[i]) : { type: 'nil', span: EMPTY_SPAN } }))
  }
  if (valueList) {
    const indices = tokensOf(valueList, 'IntegerLiteral')
    const exprs = childNodes(valueList, 'expression')
    indices.forEach((idx, i) => fields.push({ field: parseInt(idx.image, 10), value: exprs[i] ? cstToExpression(exprs[i]) : { type: 'nil', span: EMPTY_SPAN } }))
  }
  return {
    type: 'modify_expr',
    span: spanOf(cst),
    target: target ? cstToExpression(target) : { type: 'nil', span: EMPTY_SPAN },
    isProduct,
    fields
  }
}

function cstToGeneralExpr(cst: CstNode): ExpressionNode {
  const atom = singleChild(cst, 'generalAtom')
  let result = atom ? cstToGeneralAtom(atom) : nilExpr()
  for (const postfix of childNodes(cst, 'generalPostfix')) {
    result = cstToGeneralPostfix(postfix, result)
  }
  return result
}

function cstToGeneralAtom(cst: CstNode): ExpressionNode {
  const nil = tokensOf(cst, 'Nil')
  if (nil.length > 0) return { type: 'nil', span: spanOf(cst) }
  const simple = singleChild(cst, 'simpleVariable')
  if (simple) {
    const tilde = tokensOf(simple, 'Tilde')
    const id = tokensOf(simple, 'Identifier')[0]
    return { type: 'identifier', span: spanOf(cst), name: id?.image ?? '', negated: tilde.length > 0 }
  }
  const seq = singleChild(cst, 'seqExpr')
  if (seq) return cstToSeqExpr(seq)
  const map = singleChild(cst, 'mapExpr')
  if (map) return cstToMapExpr(map)
  const product = singleChild(cst, 'productExpr')
  if (product) return cstToProductExpr(product)
  const cop = singleChild(cst, 'compositeOrProductExpr')
  if (cop) return cstToCompositeOrProduct(cop)
  const compound = singleChild(cst, 'compoundExpr')
  if (compound) return cstToCompoundExpr(compound)
  const get = tokensOf(cst, 'Get')
  if (get.length > 0) {
    const se = singleChild(cst, 'setExpr')
    return { type: 'call', span: spanOf(cst), callee: 'get', args: se ? [cstToSetExpr(se)] : [] }
  }
  const hd = tokensOf(cst, 'Hd')
  if (hd.length > 0) {
    const sq = singleChild(cst, 'seqExpr')
    return { type: 'call', span: spanOf(cst), callee: 'hd', args: sq ? [cstToSeqExpr(sq)] : [] }
  }
  const inner = childNodes(cst, 'generalExpr')[0]
  if (inner) return { type: 'paren_expr', span: spanOf(cst), inner: cstToGeneralExpr(inner) }
  return nilExpr()
}

function cstToGeneralPostfix(cst: CstNode, base: ExpressionNode): ExpressionNode {
  const dot = tokensOf(cst, 'Dot')
  if (dot.length > 0) {
    const id = tokensOf(cst, 'Identifier')[0]
    return { type: 'field_access', span: spanOf(cst), object: base, field: id?.image ?? '' }
  }
  const list = singleChild(cst, 'expressionList')
  return {
    type: 'call',
    span: spanOf(cst),
    callee: base,
    args: list ? childNodes(list, 'expression').map(cstToExpression) : []
  }
}

function cstToCompoundExpr(cst: CstNode): ExpressionNode {
  const ifE = singleChild(cst, 'ifExpr')
  if (ifE) {
    const pred = singleChild(ifE, 'predicate')
    const exprs = childNodes(ifE, 'expression')
    return {
      type: 'if_expr',
      span: spanOf(cst),
      condition: pred ? cstToPredicate(pred) : { type: 'predicate', span: EMPTY_SPAN, disjuncts: [] },
      thenExpr: exprs[0] ? cstToExpression(exprs[0]) : { type: 'nil', span: EMPTY_SPAN },
      elseExpr: exprs[1] ? cstToExpression(exprs[1]) : { type: 'nil', span: EMPTY_SPAN }
    }
  }
  const letE = singleChild(cst, 'letExpr')
  if (letE) {
    const pattern = singleChild(letE, 'patternDef')
    const body = singleChild(letE, 'expression')
    return {
      type: 'let_expr',
      span: spanOf(cst),
      bindings: pattern ? cstToLetBindings(pattern) : [],
      body: body ? cstToExpression(body) : { type: 'nil', span: EMPTY_SPAN }
    }
  }
  const caseE = singleChild(cst, 'caseExpr')
  if (caseE) return cstToCaseExpr(caseE)
  return { type: 'nil', span: spanOf(cst) }
}

function cstToLetBindings(cst: CstNode): LetBindingNode[] {
  const equals = tokensOf(cst, 'Equals')
  if (equals.length > 0) {
    const ids = tokensOf(cst, 'Identifier')
    const exprs = childNodes(cst, 'expression')
    return ids.map((id, i) => ({
      type: 'let_binding' as const,
      span: spanOf(cst),
      kind: 'equal' as const,
      names: [id.image],
      value: exprs[i] ? cstToExpression(exprs[i]) : undefined
    }))
  }
  const id = tokensOf(cst, 'Identifier')[0]
  const typeExpr = singleChild(cst, 'typeExpr')
  const pred = singleChild(cst, 'predicate')
  return [{
    type: 'let_binding',
    span: spanOf(cst),
    kind: 'typed',
    names: id ? [id.image] : [],
    typeExpr: typeExpr ? cstToTypeExpr(typeExpr) : undefined,
    guard: pred ? cstToPredicate(pred) : undefined
  }]
}

function cstToCaseExpr(cst: CstNode): ExpressionNode {
  const scrutinee = singleChild(cst, 'expression')
  const alts = singleChild(cst, 'caseAlternatives')
  const defaultE = singleChild(cst, 'defaultExpr')
  return {
    type: 'case_expr',
    span: spanOf(cst),
    scrutinee: scrutinee ? cstToExpression(scrutinee) : { type: 'nil', span: EMPTY_SPAN },
    alternatives: alts ? childNodes(alts, 'caseAlt').map((a) => {
      const ids = tokensOf(a, 'Identifier')
      const expr = singleChild(a, 'expression')
      return {
        type: 'case_alt' as const,
        span: spanOf(a),
        patterns: ids.map((t) => t.image),
        expr: expr ? cstToExpression(expr) : { type: 'nil', span: EMPTY_SPAN }
      }
    }) : [],
    default: defaultE ? cstToExpression(singleChild(defaultE, 'expression')!) : undefined
  }
}

function nilExpr(): ExpressionNode {
  return { type: 'nil', span: EMPTY_SPAN }
}

function cstToRelationalExpr(cst: CstNode): ExpressionNode {
  const exprs = childNodes(cst, 'expression')
  const left = exprs[0] ? cstToExpression(exprs[0]) : nilExpr()
  const right = exprs[1] ? cstToExpression(exprs[1]) : nilExpr()
  if (tokensOf(cst, 'Equals').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'eq', left, right }
  }
  if (tokensOf(cst, 'NotEqual').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'neq', left, right }
  }
  if (tokensOf(cst, 'LessThan').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'lt', left, right }
  }
  if (tokensOf(cst, 'LessEqual').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'le', left, right }
  }
  if (tokensOf(cst, 'GreaterThan').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'gt', left, right }
  }
  if (tokensOf(cst, 'GreaterEqual').length) {
    return { type: 'relational_expr', span: spanOf(cst), kind: 'ge', left, right }
  }
  if (tokensOf(cst, 'Inset').length) {
    const set = singleChild(cst, 'setExpr')
    return { type: 'relational_expr', span: spanOf(cst), kind: 'inset', left, right: set ? cstToSetExpr(set) : nilExpr() }
  }
  if (tokensOf(cst, 'Notin').length) {
    const set = singleChild(cst, 'setExpr')
    return { type: 'relational_expr', span: spanOf(cst), kind: 'notin', left, right: set ? cstToSetExpr(set) : nilExpr() }
  }
  return left
}

export function cstToModuleAst(cst: CstNode): ModuleNode {
  if (cst.name === 'topModule') return cstToTopModule(cst)
  return cstToRegularModule(cst)
}

export { cstToProgram as convertCstToAst }
