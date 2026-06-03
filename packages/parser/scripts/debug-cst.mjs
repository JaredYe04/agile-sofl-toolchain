import { AgileSoflLexer } from '../dist/lexer/tokens.js'
import { parserInstance } from '../dist/parser/parser.js'

function tryParse(rule, src) {
  parserInstance.reset()
  const lex = AgileSoflLexer.tokenize(src)
  parserInstance.input = lex.tokens
  const cst = parserInstance[rule]()
  return { cst, errors: [...parserInstance.errors] }
}

const minimal = 'module Foo;\nvar x: nat;\nend_module'
const r = tryParse('module', minimal)
console.log('errors', r.errors.map((e) => ({ msg: e.message.slice(0, 80), token: e.token?.image, line: e.token?.startLine })))
console.log('CST keys', Object.keys(r.cst?.children ?? {}))
const body = r.cst?.children?.moduleBody?.[0]
console.log('body keys', body ? Object.keys(body.children) : null)
if (body?.children?.varDecls?.[0]) {
  const vd = body.children.varDecls[0]
  console.log('varDecls keys', Object.keys(vd.children))
  console.log('varItem count', (vd.children.varItem?.length ?? 0) + (vd.children.varItem2?.length ?? 0))
}

const constType = 'module SYSTEM_T;\nconst a = 1; b = 2;\ntype S = set of nat;\nvar x: S;\nend_module'
const r2 = tryParse('module', constType)
console.log('\nconstType errors', r2.errors.length)
for (const e of r2.errors.slice(0, 5)) {
  console.log(' ', e.token?.startLine, e.message.slice(0, 60))
}
