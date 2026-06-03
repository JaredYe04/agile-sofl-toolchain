import type * as Monaco from 'monaco-editor'

export interface ScopeMapRule {
  prefix: string
  colorClass: string
}

export interface ScopeMap {
  default: string
  rules: ScopeMapRule[]
  monaco?: Record<string, string>
}

const DEFAULT_MONACO_MAP: Record<string, string> = {
  plain: '',
  kwCtrl: 'keyword.control.asfl',
  systemPrefix: 'keyword.control.system-prefix.asfl',
  kwDecl: 'keyword.declaration.asfl',
  kwMod: 'keyword.modifier.rdwr.asfl',
  informalMarker: 'keyword.other.informal-marker.asfl',
  informalText: 'string.unquoted.informal.asfl',
  informalMeta: 'meta.comment.informal.asfl',
  fsfBranch: 'keyword.other.fsf-branch.asfl',
  fsfOp: 'keyword.other.fsf.asfl',
  fsfMeta: 'meta.fsf.asfl',
  operator: 'keyword.operator.logical.asfl',
  type: 'storage.type.asfl',
  module: 'entity.name.namespace.asfl',
  entityFn: 'entity.name.function.asfl',
  entityType: 'entity.name.type.asfl',
  entityTag: 'entity.name.tag.asfl',
  param: 'variable.parameter.asfl',
  identifier: 'variable.other.asfl',
  string: 'string.quoted.double.asfl',
  enum: 'constant.other.enum.asfl',
  number: 'constant.numeric',
  literal: 'constant.language',
  comment: 'comment.block.asfl',
  punct: 'punctuation'
}

export function scopeToColorClass(scopes: string[], scopeMap: ScopeMap): string {
  if (!scopes || scopes.length === 0) return scopeMap.default
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i]
    for (const rule of scopeMap.rules) {
      if (scope === rule.prefix || scope.startsWith(`${rule.prefix}.`)) {
        return rule.colorClass
      }
    }
  }
  return scopeMap.default
}

export function scopeToMonacoToken(scopes: string[], scopeMap: ScopeMap): string {
  const map = scopeMap.monaco ?? DEFAULT_MONACO_MAP
  const colorClass = scopeToColorClass(scopes, scopeMap)
  return map[colorClass] ?? scopes[scopes.length - 1] ?? ''
}

export function mergeScopeMap(raw: ScopeMap): ScopeMap {
  return { ...raw, monaco: { ...DEFAULT_MONACO_MAP, ...raw.monaco } }
}

export class TokenizerState implements Monaco.languages.IState {
  constructor(public readonly ruleStack: unknown) {}

  clone(): Monaco.languages.IState {
    return new TokenizerState(this.ruleStack)
  }

  equals(other: Monaco.languages.IState): boolean {
    return other instanceof TokenizerState && other.ruleStack === this.ruleStack
  }
}
