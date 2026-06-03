import { loadWASM, createOnigScanner, createOnigString } from 'vscode-oniguruma'
import { Registry, type IGrammar, type IOnigLib, INITIAL } from 'vscode-textmate'
import { monaco } from './setup'

let grammarReady: Promise<IGrammar> | null = null

async function loadOnigLib(): Promise<IOnigLib> {
  const wasm = await fetch('/syntax/onig.wasm').then((r) => r.arrayBuffer())
  await loadWASM(wasm)
  return {
    createOnigScanner: (patterns) => createOnigScanner(patterns),
    createOnigString: (str) => createOnigString(str)
  }
}

async function getGrammar(): Promise<IGrammar> {
  if (!grammarReady) {
    grammarReady = (async () => {
      const onigLib = await loadOnigLib()
      const grammar = await fetch('/syntax/agile-sofl.tmLanguage.json').then((r) => r.json())
      const registry = new Registry({
        onigLib: Promise.resolve(onigLib),
        scopeNameToLanguage: { 'source.asfl': 'agile-sofl' },
        loadGrammar: async (scopeName) => (scopeName === 'source.asfl' ? grammar : null)
      })
      const g = await registry.loadGrammar('source.asfl')
      if (!g) throw new Error('Failed to load agile-sofl grammar')
      return g
    })()
  }
  return grammarReady
}

class TokenizerState implements monaco.languages.IState {
  constructor(public readonly ruleStack: typeof INITIAL) {}

  clone(): monaco.languages.IState {
    return new TokenizerState(this.ruleStack)
  }

  equals(other: monaco.languages.IState): boolean {
    return other instanceof TokenizerState && other.ruleStack === this.ruleStack
  }
}

export async function registerTextMateTokens(): Promise<void> {
  const grammar = await getGrammar()

  monaco.languages.setTokensProvider('agile-sofl', {
    getInitialState: () => new TokenizerState(INITIAL),
    tokenize: (line: string, state: monaco.languages.IState) => {
      const stack = state instanceof TokenizerState ? state.ruleStack : INITIAL
      const result = grammar.tokenizeLine(line, stack)
      return {
        endState: new TokenizerState(result.ruleStack),
        tokens: result.tokens.map((t) => ({ startIndex: t.startIndex, scopes: t.scopes }))
      }
    }
  })
}

export async function registerLanguageConfiguration(): Promise<void> {
  const config = await fetch('/syntax/language-configuration.json').then((r) => r.json())
  monaco.languages.setLanguageConfiguration('agile-sofl', {
    comments: config.comments,
    brackets: config.brackets,
    autoClosingPairs: config.autoClosingPairs,
    surroundingPairs: config.surroundingPairs,
    folding: config.folding,
    indentationRules: config.indentationRules
  })
}
