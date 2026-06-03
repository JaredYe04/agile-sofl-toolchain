import { AgileSoflLexer } from '../dist/lexer/tokens.js'
import { parserInstance } from '../dist/parser/parser.js'

const src = 'module SYSTEM_E;\nvar x: nat;\ninv x > 0 and x <> 10;\nend_module'
parserInstance.reset()
const lex = AgileSoflLexer.tokenize(src)
parserInstance.input = lex.tokens
const cst = parserInstance.specification()
console.log('errors', parserInstance.errors.map(e => ({ line: e.token?.startLine, msg: e.message.slice(0,70), tok: e.token?.image })))
console.log('cst keys', Object.keys(cst.children))
const modules = cst.children.modules?.[0]
console.log('modules keys', modules ? Object.keys(modules.children) : null)
const top = modules?.children?.topModule?.[0]
console.log('top keys', top ? Object.keys(top.children) : null)
const body = top?.children?.moduleBody?.[0]
const inv = body?.children?.invDecls?.[0]
console.log('inv keys', inv ? Object.keys(inv.children) : null)
if (inv) {
  console.log('predicate count', (inv.children.predicate?.length ?? 0) + (inv.children.predicate2?.length ?? 0))
}
