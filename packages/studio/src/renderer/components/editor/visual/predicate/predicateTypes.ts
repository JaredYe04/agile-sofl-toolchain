export type SymbolHint = { label: string; kind: 'var' | 'const' | 'type' | 'param' | 'keyword' }

export type PredicateUiNode =
  | { kind: 'or'; children: PredicateUiNode[] }
  | { kind: 'and'; children: PredicateUiNode[] }
  | { kind: 'not'; child: PredicateUiNode }
  | {
      kind: 'quantified'
      quantifier: 'forall' | 'exists' | 'exists_unique'
      bindings: string
      nested: string[]
      body: PredicateUiNode
    }
  | { kind: 'relational'; left: string; op: string; right: string; text: string }
  | { kind: 'informal'; text: string }
  | { kind: 'expr'; text: string }
  | { kind: 'literal'; value: 'true' | 'false' }
  | { kind: 'code'; text: string }

export type AddNodeKind =
  | 'literal-true'
  | 'literal-false'
  | 'expr'
  | 'relational'
  | 'quantified-forall'
  | 'quantified-exists'
  | 'and'
  | 'or'
  | 'informal'
