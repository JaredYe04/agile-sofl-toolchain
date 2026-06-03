import { createToken, Lexer, TokenType } from 'chevrotain'

/** Keyword pattern with word boundaries (avoids matching prefixes like `in` inside `informal`). */
function kw(word: string): RegExp {
  return new RegExp(`\\b${word}\\b`)
}
export const Others = createToken({ name: 'Others', pattern: kw('others') })
export const EndModule = createToken({ name: 'EndModule', pattern: kw('end_module') })
export const EndProcess = createToken({ name: 'EndProcess', pattern: kw('end_process') })
export const EndFunction = createToken({ name: 'EndFunction', pattern: kw('end_function') })
export const EndCase = createToken({ name: 'EndCase', pattern: kw('end_case') })
export const Composed = createToken({ name: 'Composed', pattern: kw('composed') })
export const Universal = createToken({ name: 'Universal', pattern: kw('universal') })
export const Undefined = createToken({ name: 'Undefined', pattern: kw('undefined') })
export const Forevery = createToken({ name: 'Forevery', pattern: kw('forevery') })
export const Forsome = createToken({ name: 'Forsome', pattern: kw('forsome') })
export const Default = createToken({ name: 'Default', pattern: kw('default') })
export const Comment = createToken({ name: 'Comment', pattern: kw('comment') })
export const Decom = createToken({ name: 'Decom', pattern: kw('decom') })
export const Module = createToken({ name: 'Module', pattern: kw('module') })
export const Process = createToken({ name: 'Process', pattern: kw('process') })
export const Function = createToken({ name: 'Function', pattern: kw('function') })
export const Const = createToken({ name: 'Const', pattern: kw('const') })
export const Type = createToken({ name: 'Type', pattern: kw('type') })
export const Var = createToken({ name: 'Var', pattern: kw('var') })
export const Inv = createToken({ name: 'Inv', pattern: kw('inv') })
export const Ext = createToken({ name: 'Ext', pattern: kw('ext') })
export const Init = createToken({ name: 'Init', pattern: /\bInit\b/ })
export const Equal = createToken({ name: 'Equal', pattern: kw('equal') })
export const Fsf = createToken({ name: 'Fsf', pattern: /\bFSF\b/ })
export const Forall = createToken({ name: 'Forall', pattern: kw('forall') })
export const Exists = createToken({ name: 'Exists', pattern: kw('exists') })
export const In = createToken({ name: 'In', pattern: kw('in') })
export const Case = createToken({ name: 'Case', pattern: kw('case') })
export const Of = createToken({ name: 'Of', pattern: kw('of') })
export const And = createToken({ name: 'And', pattern: kw('and') })
export const Or = createToken({ name: 'Or', pattern: kw('or') })
export const Not = createToken({ name: 'Not', pattern: kw('not') })
export const Div = createToken({ name: 'Div', pattern: kw('div') })
export const Rem = createToken({ name: 'Rem', pattern: kw('rem') })
export const Mod = createToken({ name: 'Mod', pattern: kw('mod') })
export const Rd = createToken({ name: 'Rd', pattern: kw('rd') })
export const Wr = createToken({ name: 'Wr', pattern: kw('wr') })
export const End = createToken({ name: 'End', pattern: kw('end') })
export const To = createToken({ name: 'To', pattern: kw('to') })
export const If = createToken({ name: 'If', pattern: kw('if') })
export const Let = createToken({ name: 'Let', pattern: kw('let') })
export const Nat = createToken({ name: 'Nat', pattern: kw('nat') })
export const Int = createToken({ name: 'Int', pattern: kw('int') })
export const Real = createToken({ name: 'Real', pattern: kw('real') })
export const Char = createToken({ name: 'Char', pattern: kw('char') })
export const Bool = createToken({ name: 'Bool', pattern: kw('bool') })
export const Set = createToken({ name: 'Set', pattern: kw('set') })
export const Seq = createToken({ name: 'Seq', pattern: kw('seq') })
export const Map = createToken({ name: 'Map', pattern: kw('map') })
export const Dom = createToken({ name: 'Dom', pattern: kw('dom') })
export const Rng = createToken({ name: 'Rng', pattern: kw('rng') })
export const Get = createToken({ name: 'Get', pattern: kw('get') })
export const Abs = createToken({ name: 'Abs', pattern: kw('abs') })
export const Nil = createToken({ name: 'Nil', pattern: kw('nil') })
export const True = createToken({ name: 'True', pattern: kw('true') })
export const False = createToken({ name: 'False', pattern: kw('false') })
export const Notin = createToken({ name: 'Notin', pattern: kw('notin') })
export const Inset = createToken({ name: 'Inset', pattern: kw('inset') })
export const Override = createToken({ name: 'Override', pattern: kw('override') })
export const Inverse = createToken({ name: 'Inverse', pattern: kw('inverse') })
export const Domrt = createToken({ name: 'Domrt', pattern: kw('domrt') })
export const Rngrt = createToken({ name: 'Rngrt', pattern: kw('rngrt') })
export const Domrb = createToken({ name: 'Domrb', pattern: kw('domrb') })
export const Rngrb = createToken({ name: 'Rngrb', pattern: kw('rngrb') })
export const Psubset = createToken({ name: 'Psubset', pattern: kw('psubset') })
export const Subset = createToken({ name: 'Subset', pattern: kw('subset') })
export const Dunion = createToken({ name: 'Dunion', pattern: kw('dunion') })
export const Dinter = createToken({ name: 'Dinter', pattern: kw('dinter') })
export const Dconc = createToken({ name: 'Dconc', pattern: kw('dconc') })
export const Union = createToken({ name: 'Union', pattern: kw('union') })
export const Inter = createToken({ name: 'Inter', pattern: kw('inter') })
export const Power = createToken({ name: 'Power', pattern: kw('power') })
export const Elems = createToken({ name: 'Elems', pattern: kw('elems') })
export const Inds = createToken({ name: 'Inds', pattern: kw('inds') })
export const Floor = createToken({ name: 'Floor', pattern: kw('floor') })
export const Bound = createToken({ name: 'Bound', pattern: kw('bound') })
export const Modify = createToken({ name: 'Modify', pattern: kw('modify') })
export const Comp = createToken({ name: 'Comp', pattern: kw('comp') })
export const Conc = createToken({ name: 'Conc', pattern: kw('conc') })
export const Diff = createToken({ name: 'Diff', pattern: kw('diff') })
export const Card = createToken({ name: 'Card', pattern: kw('card') })
export const Hd = createToken({ name: 'Hd', pattern: kw('hd') })
export const Tl = createToken({ name: 'Tl', pattern: kw('tl') })
export const Len = createToken({ name: 'Len', pattern: kw('len') })
export const Nat0 = createToken({ name: 'Nat0', pattern: kw('nat0') })
export const String = createToken({ name: 'String', pattern: kw('string') })
export const Given = createToken({ name: 'Given', pattern: kw('given') })
export const Sign = createToken({ name: 'Sign', pattern: kw('sign') })
export const Then = createToken({ name: 'Then', pattern: kw('then') })
export const Else = createToken({ name: 'Else', pattern: kw('else') })
export const Mk = createToken({ name: 'Mk', pattern: /mk_/ })

export const SystemPrefix = createToken({ name: 'SystemPrefix', pattern: /SYSTEM_/ })

export const IsTypePrefix = createToken({
  name: 'IsTypePrefix',
  pattern: /is_(nat0|nat|int|real|char|string|bool|given|universal|sign|[A-Za-z_][A-Za-z0-9_]*)/
})

export const DoubleEquals = createToken({ name: 'DoubleEquals', pattern: /==/ })
export const NotEqual = createToken({ name: 'NotEqual', pattern: /<>/ })
export const LessEqual = createToken({ name: 'LessEqual', pattern: /<=/ })
export const GreaterEqual = createToken({ name: 'GreaterEqual', pattern: />=/ })
export const DoublePipe = createToken({ name: 'DoublePipe', pattern: /\|\|/ })
export const DoubleAmp = createToken({ name: 'DoubleAmp', pattern: /&&/ })
export const Arrow = createToken({ name: 'Arrow', pattern: /->/ })
export const Ellipsis = createToken({ name: 'Ellipsis', pattern: /\.\.\./ })
export const PowerOp = createToken({ name: 'PowerOp', pattern: /\*\*/ })

export const LessThan = createToken({ name: 'LessThan', pattern: /</ })
export const GreaterThan = createToken({ name: 'GreaterThan', pattern: />/ })
export const Equals = createToken({ name: 'Equals', pattern: /=/ })
export const Plus = createToken({ name: 'Plus', pattern: /\+/ })
export const Minus = createToken({ name: 'Minus', pattern: /-/ })
export const Star = createToken({ name: 'Star', pattern: /\*/ })
export const Slash = createToken({ name: 'Slash', pattern: /\// })
export const Pipe = createToken({ name: 'Pipe', pattern: /\|/ })
export const Amp = createToken({ name: 'Amp', pattern: /&/ })
export const Colon = createToken({ name: 'Colon', pattern: /:/ })
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ })
export const Comma = createToken({ name: 'Comma', pattern: /,/ })
export const Dot = createToken({ name: 'Dot', pattern: /\./ })
export const LParen = createToken({ name: 'LParen', pattern: /\(/ })
export const RParen = createToken({ name: 'RParen', pattern: /\)/ })
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ })
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ })
export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ })
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ })
export const Hash = createToken({ name: 'Hash', pattern: /#/ })
export const Tilde = createToken({ name: 'Tilde', pattern: /~/ })

export const EnumValue = createToken({
  name: 'EnumValue',
  pattern: /<[A-Za-z_][A-Za-z0-9_]*>/
})

export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/
})

export const CharLiteral = createToken({
  name: 'CharLiteral',
  pattern: /'(?:[^'\\]|\\.)'/
})

export const RealLiteral = createToken({
  name: 'RealLiteral',
  pattern: /-?\d+\.\d+/
})

export const IntegerLiteral = createToken({
  name: 'IntegerLiteral',
  pattern: /-?\d+/
})

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[A-Za-z_][A-Za-z0-9_]*/
})

export const BlockComment = createToken({
  name: 'BlockComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED
})

export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED
})

export const allTokens: TokenType[] = [
  WhiteSpace,
  BlockComment,
  // Multi-char operators first
  DoubleEquals,
  NotEqual,
  LessEqual,
  GreaterEqual,
  DoublePipe,
  DoubleAmp,
  Arrow,
  Ellipsis,
  PowerOp,
  IsTypePrefix,
  SystemPrefix,
  Mk,
  // Keywords (longer first)
  Others,
  EndModule,
  EndProcess,
  EndFunction,
  EndCase,
  Composed,
  Universal,
  Undefined,
  Notin,
  Inset,
  Override,
  Inverse,
  Domrt,
  Rngrt,
  Domrb,
  Rngrb,
  Psubset,
  Subset,
  Dunion,
  Dinter,
  Dconc,
  Comment,
  Decom,
  Module,
  Process,
  Function,
  Const,
  Type,
  Var,
  Inv,
  Ext,
  Init,
  Equal,
  Fsf,
  Forall,
  Forevery,
  Exists,
  Forsome,
  True,
  False,
  Nil,
  Union,
  Inter,
  Power,
  Elems,
  Inds,
  Floor,
  Bound,
  Modify,
  Comp,
  Conc,
  Diff,
  Dom,
  Rng,
  Card,
  Abs,
  Get,
  Hd,
  Tl,
  Len,
  Set,
  Seq,
  Map,
  Nat0,
  Nat,
  Int,
  Real,
  Char,
  String,
  Bool,
  Given,
  Sign,
  If,
  Then,
  Else,
  Let,
  In,
  Case,
  Of,
  And,
  Or,
  Not,
  Div,
  Rem,
  Mod,
  Rd,
  Wr,
  End,
  To,
  // Literals
  EnumValue,
  StringLiteral,
  CharLiteral,
  RealLiteral,
  IntegerLiteral,
  // Single-char
  LessThan,
  GreaterThan,
  Equals,
  Plus,
  Minus,
  Star,
  Slash,
  Pipe,
  Amp,
  Colon,
  Semicolon,
  Comma,
  Dot,
  LParen,
  RParen,
  LBracket,
  RBracket,
  LBrace,
  RBrace,
  Hash,
  Tilde,
  Identifier
]

export const AgileSoflLexer = new Lexer(allTokens, {
  positionTracking: 'full'
})

export type TokenName = string

export function tokenize(source: string) {
  return AgileSoflLexer.tokenize(source)
}
