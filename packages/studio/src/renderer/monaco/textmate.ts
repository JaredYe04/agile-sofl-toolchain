import { loadWASM, createOnigScanner, createOnigString } from 'vscode-oniguruma'
import { Registry, type IGrammar, type IOnigLib, INITIAL } from 'vscode-textmate'
import { monaco } from './setup'
import { mergeScopeMap, scopeToMonacoToken, TokenizerState, type ScopeMap } from './scopeMap'

let grammarReady: Promise<{ grammar: IGrammar; scopeMap: ScopeMap }> | null = null

async function loadOnigLib(): Promise<IOnigLib> {
  const res = await fetch('/syntax/onig.wasm')
  if (!res.ok) throw new Error(`Failed to load onig.wasm: ${res.status}`)
  const wasm = await res.arrayBuffer()
  await loadWASM(wasm)
  return {
    createOnigScanner: (patterns) => createOnigScanner(patterns),
    createOnigString: (str) => createOnigString(str)
  }
}

async function getGrammarAndScopeMap(): Promise<{ grammar: IGrammar; scopeMap: ScopeMap }> {
  if (!grammarReady) {
    grammarReady = (async () => {
      const onigLib = await loadOnigLib()
      const [grammarRes, scopeRes] = await Promise.all([
        fetch('/syntax/agile-sofl.tmLanguage.json'),
        fetch('/syntax/highlight-scope-map.json')
      ])
      if (!grammarRes.ok) throw new Error(`Failed to load grammar: ${grammarRes.status}`)
      if (!scopeRes.ok) throw new Error(`Failed to load scope map: ${scopeRes.status}`)
      const grammar = await grammarRes.json()
      const scopeMap = mergeScopeMap(await scopeRes.json())
      const registry = new Registry({
        onigLib: Promise.resolve(onigLib),
        scopeNameToLanguage: { 'source.asfl': 'agile-sofl' },
        loadGrammar: async (scopeName) => (scopeName === 'source.asfl' ? grammar : null)
      })
      const g = await registry.loadGrammar('source.asfl')
      if (!g) throw new Error('Failed to load agile-sofl grammar')
      return { grammar: g, scopeMap }
    })()
  }
  return grammarReady
}

function registerMonarchFallback(): void {
  monaco.languages.setMonarchTokensProvider('agile-sofl', {
    keywords: ['module', 'process', 'function', 'var', 'const', 'type', 'end_module', 'end_process', 'FSF'],
    tokenizer: {
      root: [
        [/\/\*[\s\S]*?\*\//, 'comment.block.asfl'],
        [/\b(module|process|function|var|const|type|end_module|end_process|FSF)\b/, 'keyword.declaration.asfl'],
        [/[A-Za-z_]\w*/, 'variable.other.asfl']
      ]
    }
  })
}

export async function registerTextMateTokens(): Promise<void> {
  try {
    const { grammar, scopeMap } = await getGrammarAndScopeMap()
    monaco.languages.setTokensProvider('agile-sofl', {
      getInitialState: () => new TokenizerState(INITIAL),
      tokenize: (line: string, state: monaco.languages.IState) => {
        const stack = state instanceof TokenizerState ? state.ruleStack : INITIAL
        const result = grammar.tokenizeLine(line, stack as typeof INITIAL)
        return {
          endState: new TokenizerState(result.ruleStack),
          tokens: result.tokens.map((t) => ({
            startIndex: t.startIndex,
            scopes: scopeToMonacoToken(t.scopes, scopeMap)
          }))
        }
      }
    })
  } catch (err) {
    console.error('[studio] TextMate registration failed, using Monarch fallback:', err)
    registerMonarchFallback()
  }
}

export async function registerLanguageConfiguration(): Promise<void> {
  const configRes = await fetch('/syntax/language-configuration.json')
  if (!configRes.ok) throw new Error(`Failed to load language configuration: ${configRes.status}`)
  const config = await configRes.json()
  monaco.languages.setLanguageConfiguration('agile-sofl', {
    comments: config.comments,
    brackets: config.brackets,
    autoClosingPairs: config.autoClosingPairs,
    surroundingPairs: config.surroundingPairs,
    folding: config.folding,
    indentationRules: config.indentationRules
  })
}
