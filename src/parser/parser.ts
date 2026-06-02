/**
 * Chevrotain parser for Agile-SOFL.
 * Grammar source: Agile-SOFLGrammarForParser_LiuFinal.pdf (Liu, 2026)
 */
// @ts-nocheck — Chevrotain RULE methods are attached dynamically at runtime

import { CstParser, type CstNode } from 'chevrotain'
import {
  allTokens,
  Module,
  SystemPrefix,
  Identifier,
  Semicolon,
  EndModule,
  Const,
  Type,
  Var,
  Inv,
  Process,
  Function,
  Init,
  LParen,
  RParen,
  Colon,
  Comma,
  EndProcess,
  EndFunction,
  Ext,
  Rd,
  Wr,
  Fsf,
  Decom,
  Comment,
  Equal,
  DoubleEquals,
  Undefined,
  Slash,
  Dot,
  Others,
  DoublePipe,
  DoubleAmp,
  Forall,
  Exists,
  LBracket,
  RBracket,
  Pipe,
  And,
  Or,
  Not,
  Amp,
  True,
  False,
  Nil,
  Set,
  Seq,
  Map,
  Of,
  To,
  Composed,
  End,
  Universal,
  LBrace,
  RBrace,
  Star,
  If,
  Then,
  Else,
  Let,
  In,
  Case,
  Of as OfKw,
  Default,
  EndCase,
  Modify,
  Mk,
  Plus,
  Minus,
  PowerOp,
  Div,
  Rem,
  Mod,
  LessThan,
  GreaterThan,
  LessEqual,
  GreaterEqual,
  NotEqual,
  Equals,
  Inset,
  Notin,
  Arrow,
  Ellipsis,
  EnumValue,
  StringLiteral,
  CharLiteral,
  RealLiteral,
  IntegerLiteral,
  Nat0,
  Nat,
  Int,
  Real,
  Char,
  String,
  Bool,
  Given,
  Tilde,
  Hash,
  Abs,
  Floor,
  Card,
  Len,
  Get,
  Hd,
  Tl,
  Union,
  Inter,
  Diff,
  Dunion,
  Dinter,
  Power,
  Elems,
  Inds,
  Dom,
  Rng,
  Domrt,
  Rngrt,
  Domrb,
  Rngrb,
  Override,
  Inverse,
  Comp,
  Conc,
  Dconc,
  Subset,
  Psubset,
  Bound,
  IsTypePrefix
} from '../lexer/tokens.js'
import { EOF } from 'chevrotain'

const TYPE_EXPR_STOP = [Semicolon, Comma, End, RParen, RBrace, EndModule, EndProcess, EndFunction, To, Star]

function typeLooksLikeUnion($: AgileSoflParser): boolean {
  if ($.LA(1).tokenType === Universal) return true
  for (let i = 1; i <= 64; i++) {
    const t = $.LA(i).tokenType
    if (t === Pipe) return true
    if (t === EOF || TYPE_EXPR_STOP.includes(t)) return false
  }
  return false
}

function typeLooksLikeProduct($: AgileSoflParser): boolean {
  for (let i = 1; i <= 64; i++) {
    const t = $.LA(i).tokenType
    if (t === Star) return true
    if (t === EOF || TYPE_EXPR_STOP.includes(t)) return false
  }
  return false
}

export class AgileSoflParser extends CstParser {
  public specification!: () => CstNode
  public module!: () => CstNode

  constructor() {
    super(allTokens, { recoveryEnabled: true, skipValidations: true })

    const $ = this as unknown as Record<string, (...args: unknown[]) => unknown> & AgileSoflParser

    $.RULE('specification', () => {
      $.SUBRULE($.modules)
      $.OPTION(() => {
        $.CONSUME(Dot)
      })
    })

    $.RULE('modules', () => {
      $.SUBRULE($.topModule)
      $.MANY(() => {
        $.OPTION1(() => $.CONSUME(Semicolon))
        $.SUBRULE2($.module)
      })
    })

    $.RULE('topModule', () => {
      $.CONSUME(Module)
      $.CONSUME(SystemPrefix)
      $.CONSUME1(Identifier)
      $.OPTION(() => $.CONSUME(Semicolon))
      $.SUBRULE($.moduleBody)
      $.CONSUME(EndModule)
    })

    $.RULE('module', () => {
      $.CONSUME(Module)
      $.OR([
        {
          ALT: () => {
            $.CONSUME(SystemPrefix)
            $.CONSUME(Identifier)
          }
        },
        { ALT: () => { $.CONSUME1(Identifier) } }
      ])
      $.OPTION1(() => {
        $.CONSUME(Slash)
        $.CONSUME2(Identifier)
      })
      $.OPTION2(() => $.CONSUME1(Semicolon))
      $.SUBRULE($.moduleBody)
      $.CONSUME(EndModule)
    })

    $.RULE('moduleBody', () => {
      $.OPTION3(() => $.SUBRULE($.constDecls))
      $.OPTION4(() => $.SUBRULE($.typeDecls))
      $.OPTION5(() => $.SUBRULE($.varDecls))
      $.OPTION6(() => $.SUBRULE($.invDecls))
      $.SUBRULE($.processFunctionSpecs)
    })

    $.RULE('constDecls', () => {
      $.CONSUME(Const)
      $.MANY({
        GATE: () => $.LA(1).tokenType === Identifier,
        DEF: () => {
          $.SUBRULE($.constItem)
          $.OPTION(() => $.CONSUME(Semicolon))
        }
      })
    })

    $.RULE('constItem', () => {
      $.CONSUME(Identifier)
      $.CONSUME(Equals)
      $.SUBRULE($.constant)
    })

    $.RULE('typeDecls', () => {
      $.CONSUME(Type)
      $.MANY({
        GATE: () => $.LA(1).tokenType === Identifier,
        DEF: () => {
          $.SUBRULE($.typeItem)
          $.OPTION(() => $.CONSUME(Semicolon))
        }
      })
    })

    $.RULE('typeItem', () => {
      $.CONSUME(Identifier)
      $.OPTION(() => {
        $.CONSUME(Slash)
        $.SUBRULE($.moduleOrFieldAccess)
      })
      $.CONSUME(Equals)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('varDecls', () => {
      $.CONSUME(Var)
      $.MANY({
        GATE: () => {
          const t = $.LA(1).tokenType
          return t === Identifier || t === Ext
        },
        DEF: () => {
          $.SUBRULE($.varItem)
          $.OPTION(() => $.CONSUME(Semicolon))
        }
      })
    })

    $.RULE('varItem', () => {
      $.SUBRULE($.variable)
      $.CONSUME(Colon)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('variable', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Ext); $.CONSUME(Identifier) } },
        { ALT: () => { $.CONSUME1(Ext); $.CONSUME(Hash); $.CONSUME2(Identifier) } },
        { ALT: () => { $.CONSUME3(Identifier) } }
      ])
    })

    $.RULE('invDecls', () => {
      $.CONSUME(Inv)
      $.MANY({
        GATE: () => {
          const t = $.LA(1).tokenType
          return (
            t !== Type &&
            t !== Var &&
            t !== Process &&
            t !== Function &&
            t !== EndModule &&
            t !== Const
          )
        },
        DEF: () => {
          $.SUBRULE($.predicate)
          $.OPTION(() => $.CONSUME(Semicolon))
        }
      })
    })

    $.RULE('processFunctionSpecs', () => {
      $.MANY({
        GATE: () => $.LA(1).tokenType === Process,
        DEF: () => $.SUBRULE($.processDef)
      })
      $.MANY2({
        GATE: () => $.LA(1).tokenType === Function,
        DEF: () => $.SUBRULE($.functionDef)
      })
    })

    $.RULE('processDef', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Process)
            $.OR2([
              { ALT: () => $.CONSUME(Init) },
              { ALT: () => $.CONSUME(Identifier) }
            ])
            $.CONSUME(LParen)
            $.OPTION(() => $.SUBRULE($.paramDecls))
            $.CONSUME(RParen)
            $.OPTION1(() => $.SUBRULE1($.paramDecls))
            $.SUBRULE($.processBody)
            $.CONSUME(EndProcess)
          }
        },
        {
          ALT: () => {
            $.CONSUME1(Process)
            $.CONSUME1(Identifier)
            $.CONSUME(Equal)
            $.SUBRULE($.moduleOrFieldAccess)
            $.CONSUME2(EndProcess)
          }
        }
      ])
    })

    $.RULE('processBody', () => {
      $.OPTION(() => {
        $.CONSUME(Ext)
        $.SUBRULE($.extVars)
      })
      $.OPTION1(() => {
        $.CONSUME(Fsf)
        $.CONSUME(Colon)
        $.SUBRULE($.fsfSpec)
      })
      $.OPTION2(() => {
        $.CONSUME(Decom)
        $.CONSUME1(Colon)
        $.CONSUME(Identifier)
      })
      $.OPTION3(() => {
        $.CONSUME(Comment)
        $.CONSUME2(Colon)
        $.SUBRULE($.text)
      })
    })

    $.RULE('extVars', () => {
      $.SUBRULE($.extVar)
      $.MANY(() => {
        $.SUBRULE2($.extVar)
      })
    })

    $.RULE('extVar', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Rd); $.CONSUME(Identifier) } },
        { ALT: () => { $.CONSUME(Wr); $.CONSUME1(Identifier) } }
      ])
      $.OPTION(() => {
        $.CONSUME(Colon)
        $.SUBRULE($.typeExpr)
      })
    })

    $.RULE('fsfSpec', () => {
      $.OR([
        {
          ALT: () => {
            $.SUBRULE($.fsfExpression)
            $.OPTION(() => {
              $.CONSUME(DoublePipe)
              $.CONSUME(Others)
              $.CONSUME(DoubleAmp)
              $.SUBRULE($.predicate)
            })
          }
        },
        {
          ALT: () => {
            $.CONSUME1(Others)
            $.CONSUME1(DoubleAmp)
            $.SUBRULE1($.predicate)
          }
        }
      ])
    })

    $.RULE('fsfExpression', () => {
      $.SUBRULE($.fsfScenario)
      $.MANY({
        GATE: () => $.LA(1).tokenType === DoublePipe && $.LA(2).tokenType !== Others,
        DEF: () => {
          $.CONSUME(DoublePipe)
          $.SUBRULE2($.fsfScenario)
        }
      })
    })

    $.RULE('fsfScenario', () => {
      $.SUBRULE($.predicate)
      $.CONSUME(DoubleAmp)
      $.SUBRULE1($.predicate)
    })

    $.RULE('functions', () => {
      $.SUBRULE($.functionDef)
      $.MANY(() => {
        $.CONSUME(Semicolon)
        $.SUBRULE2($.functionDef)
      })
    })

    $.RULE('functionDef', () => {
      $.CONSUME(Function)
      $.CONSUME(Identifier)
      $.CONSUME(LParen)
      $.OPTION(() => $.SUBRULE($.paramDecls))
      $.CONSUME(RParen)
      $.CONSUME(Colon)
      $.SUBRULE($.typeExpr)
      $.OPTION1(() => $.SUBRULE($.fsfSpec))
      $.OPTION2(() => {
        $.CONSUME(DoubleEquals)
        $.OR([
          { ALT: () => $.SUBRULE($.expression) },
          { ALT: () => $.CONSUME(Undefined) }
        ])
      })
      $.CONSUME(EndFunction)
    })

    $.RULE('paramDecls', () => {
      $.SUBRULE($.paramGroup)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.SUBRULE2($.paramGroup)
      })
    })

    $.RULE('paramGroup', () => {
      $.CONSUME(Identifier)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME2(Identifier)
      })
      $.CONSUME(Colon)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('moduleOrFieldAccess', () => {
      $.OPTION(() => {
        $.CONSUME(Identifier)
        $.CONSUME(Dot)
      })
      $.CONSUME1(Identifier)
    })

    $.RULE('typeExpr', () => {
      $.OR([
        {
          ALT: () => $.SUBRULE($.unionType),
          GATE: () => typeLooksLikeUnion($)
        },
        { ALT: () => $.SUBRULE($.moduleOrFieldAccess) },
        { ALT: () => $.SUBRULE($.otherType) }
      ])
    })

    $.RULE('typeAtomic', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.basicType) },
        { ALT: () => $.SUBRULE($.enumType) },
        { ALT: () => $.SUBRULE($.setType) },
        { ALT: () => $.SUBRULE($.seqType) },
        { ALT: () => $.SUBRULE($.composedType) },
        { ALT: () => $.SUBRULE($.mapType) }
      ])
    })

    $.RULE('typePrimary', () => {
      $.SUBRULE($.typeAtomic)
    })

    $.RULE('otherType', () => {
      $.OR([
        {
          ALT: () => $.SUBRULE($.productType),
          GATE: () => typeLooksLikeProduct($)
        },
        { ALT: () => $.SUBRULE($.typeAtomic) }
      ])
    })

    $.RULE('basicType', () => {
      $.OR([
        { ALT: () => $.CONSUME(Nat0) },
        { ALT: () => $.CONSUME(Nat) },
        { ALT: () => $.CONSUME(Int) },
        { ALT: () => $.CONSUME(Real) },
        { ALT: () => $.CONSUME(Char) },
        { ALT: () => $.CONSUME(String) },
        { ALT: () => $.CONSUME(Bool) },
        { ALT: () => $.CONSUME(Given) }
      ])
    })

    $.RULE('enumType', () => {
      $.CONSUME(LBrace)
      $.CONSUME(EnumValue)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME2(EnumValue)
      })
      $.CONSUME(RBrace)
    })

    $.RULE('setType', () => {
      $.CONSUME(Set)
      $.CONSUME(Of)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('seqType', () => {
      $.CONSUME(Seq)
      $.CONSUME(Of)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('composedType', () => {
      $.CONSUME(Composed)
      $.CONSUME(Of)
      $.SUBRULE($.fieldList)
      $.CONSUME(End)
    })

    $.RULE('fieldList', () => {
      $.SUBRULE($.fieldDecl)
      $.MANY(() => {
        $.SUBRULE2($.fieldDecl)
      })
    })

    $.RULE('fieldDecl', () => {
      $.CONSUME(Identifier)
      $.CONSUME(Colon)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('productType', () => {
      $.SUBRULE($.typeAtomic)
      $.CONSUME(Star)
      $.SUBRULE2($.typeAtomic)
      $.MANY(() => {
        $.CONSUME1(Star)
        $.SUBRULE3($.typeAtomic)
      })
    })

    $.RULE('mapType', () => {
      $.CONSUME(Map)
      $.SUBRULE($.typeExpr)
      $.CONSUME(To)
      $.SUBRULE2($.typeExpr)
    })

    $.RULE('unionType', () => {
      $.OR([
        { ALT: () => $.CONSUME(Universal) },
        {
          ALT: () => {
            $.SUBRULE($.typeAtomic)
            $.AT_LEAST_ONE(() => {
              $.CONSUME(Pipe)
              $.SUBRULE2($.typeAtomic)
            })
          }
        }
      ])
    })

    $.RULE('constant', () => {
      $.OR([
        { ALT: () => $.CONSUME(Nil) },
        { ALT: () => $.SUBRULE($.booleanValue) },
        { ALT: () => $.SUBRULE($.moduleOrFieldAccess) },
        { ALT: () => $.SUBRULE($.numberExpr) },
        { ALT: () => $.SUBRULE($.charValue) },
        { ALT: () => $.CONSUME(EnumValue) },
        { ALT: () => $.SUBRULE($.setConstant) },
        { ALT: () => $.SUBRULE($.seqConstant) },
        { ALT: () => $.SUBRULE($.mapConstant) },
        { ALT: () => $.SUBRULE($.mkConstant) }
      ])
    })

    $.RULE('booleanValue', () => {
      $.OR([
        { ALT: () => $.CONSUME(True) },
        { ALT: () => $.CONSUME(False) }
      ])
    })

    $.RULE('number', () => {
      $.OR([
        { ALT: () => $.CONSUME(RealLiteral) },
        { ALT: () => $.CONSUME(IntegerLiteral) }
      ])
    })

    $.RULE('charValue', () => {
      $.CONSUME(CharLiteral)
    })

    $.RULE('setConstant', () => {
      $.CONSUME(LBrace)
      $.OR([
        { ALT: () => { $.CONSUME(RBrace) } },
        { ALT: () => { $.SUBRULE($.constantList); $.CONSUME1(RBrace) } },
        {
          ALT: () => {
            $.SUBRULE($.number)
            $.CONSUME(Comma)
            $.CONSUME(Ellipsis)
            $.CONSUME1(Comma)
            $.SUBRULE1($.number)
            $.CONSUME2(RBrace)
          }
        }
      ])
    })

    $.RULE('seqConstant', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.stringValue) },
        {
          ALT: () => {
            $.CONSUME(LBracket)
            $.OR2([
              { ALT: () => { $.CONSUME(RBracket) } },
              { ALT: () => { $.SUBRULE($.constantList); $.CONSUME1(RBracket) } },
              {
                ALT: () => {
                  $.SUBRULE($.number)
                  $.CONSUME(Comma)
                  $.CONSUME(Ellipsis)
                  $.CONSUME1(Comma)
                  $.SUBRULE1($.number)
                  $.CONSUME2(RBracket)
                }
              }
            ])
          }
        }
      ])
    })

    $.RULE('mapConstant', () => {
      $.CONSUME(LBrace)
      $.OR([
        { ALT: () => { $.CONSUME(Arrow); $.CONSUME(RBrace) } },
        {
          ALT: () => {
            $.SUBRULE($.constant)
            $.CONSUME1(Arrow)
            $.SUBRULE1($.constant)
            $.MANY(() => {
              $.CONSUME(Comma)
              $.SUBRULE2($.constant)
              $.CONSUME2(Arrow)
              $.SUBRULE3($.constant)
            })
            $.CONSUME1(RBrace)
          }
        }
      ])
    })

    $.RULE('mkConstant', () => {
      $.CONSUME(Mk)
      $.SUBRULE($.moduleOrFieldAccess)
      $.CONSUME(LParen)
      $.OPTION(() => $.SUBRULE($.constantList))
      $.CONSUME(RParen)
    })

    $.RULE('constantList', () => {
      $.SUBRULE($.constant)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.SUBRULE2($.constant)
      })
    })

    $.RULE('stringValue', () => {
      $.CONSUME(StringLiteral)
    })

    $.RULE('text', () => {
      $.AT_LEAST_ONE(() => {
        $.OR([
          { ALT: () => $.CONSUME(StringLiteral) },
          { ALT: () => $.CONSUME(Identifier) }
        ])
      })
    })

    // --- Predicates (DNF) ---

    $.RULE('predicate', () => {
      $.SUBRULE($.conjunction)
      $.MANY(() => {
        $.CONSUME(Or)
        $.SUBRULE2($.conjunction)
      })
    })

    $.RULE('conjunction', () => {
      $.SUBRULE($.atomicPredicate)
      $.MANY(() => {
        $.CONSUME(And)
        $.SUBRULE2($.atomicPredicate)
      })
    })

    $.RULE('atomicPredicate', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.booleanValue) },
        {
          ALT: () => $.SUBRULE($.relationalExpr),
          GATE: () => {
            if ($.LA(1).tokenType !== Identifier) return true
            const next = $.LA(2).tokenType
            return next !== Identifier && next !== StringLiteral
          }
        },
        { ALT: () => $.SUBRULE($.booleanApply) },
        { ALT: () => $.SUBRULE($.quantified) },
        {
          ALT: () => $.SUBRULE($.text),
          GATE: () => {
            if ($.LA(1).tokenType === StringLiteral) return true
            if ($.LA(1).tokenType !== Identifier) return false
            const next = $.LA(2).tokenType
            return next === Identifier || next === StringLiteral
          }
        },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.atomicPredicate); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Not); $.SUBRULE1($.atomicPredicate) } }
      ])
    })

    $.RULE('quantified', () => {
      $.OR([
        { ALT: () => $.CONSUME(Forall) },
        { ALT: () => $.CONSUME(Exists) }
      ])
      $.OPTION(() => $.CONSUME1(Not))
      $.CONSUME(LBracket)
      $.SUBRULE($.bindingList)
      $.CONSUME(RBracket)
      $.MANY(() => $.SUBRULE($.quantifierList))
      $.CONSUME(Pipe)
      $.SUBRULE($.predicate)
    })

    $.RULE('quantifierList', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Forall); $.CONSUME(LBracket); $.SUBRULE($.bindingList); $.CONSUME(RBracket) } },
        { ALT: () => { $.CONSUME(Exists); $.OPTION(() => $.CONSUME(Not)); $.CONSUME1(LBracket); $.SUBRULE1($.bindingList); $.CONSUME1(RBracket) } }
      ])
    })

    $.RULE('bindingList', () => {
      $.SUBRULE($.bindingGroup)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.SUBRULE2($.bindingGroup)
      })
    })

    $.RULE('bindingGroup', () => {
      $.CONSUME(Identifier)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME2(Identifier)
      })
      $.CONSUME(Colon)
      $.SUBRULE($.typeExpr)
    })

    $.RULE('booleanApply', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Bound); $.CONSUME(LParen); $.CONSUME(Identifier); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Subset); $.CONSUME1(LParen); $.SUBRULE($.setExpr); $.CONSUME(Comma); $.SUBRULE1($.setExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME(Psubset); $.CONSUME2(LParen); $.SUBRULE2($.setExpr); $.CONSUME1(Comma); $.SUBRULE3($.setExpr); $.CONSUME2(RParen) } },
        { ALT: () => { $.CONSUME(IsTypePrefix); $.CONSUME3(LParen); $.SUBRULE($.expression); $.CONSUME3(RParen) } }
      ])
    })

    $.RULE('relationalExpr', () => {
      $.SUBRULE($.expression)
      $.OPTION(() => {
        $.OR([
          { ALT: () => { $.CONSUME(Equals); $.SUBRULE1($.expression) } },
          { ALT: () => { $.CONSUME(NotEqual); $.SUBRULE2($.expression) } },
          { ALT: () => { $.CONSUME(LessThan); $.SUBRULE3($.expression) } },
          { ALT: () => { $.CONSUME(LessEqual); $.SUBRULE4($.expression) } },
          { ALT: () => { $.CONSUME(GreaterThan); $.SUBRULE5($.expression) } },
          { ALT: () => { $.CONSUME(GreaterEqual); $.SUBRULE6($.expression) } },
          { ALT: () => { $.CONSUME(Inset); $.SUBRULE($.setExpr) } },
          { ALT: () => { $.CONSUME(Notin); $.SUBRULE7($.setExpr) } }
        ])
      })
    })

    // --- Expressions ---

    $.RULE('expression', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.numberExpr) },
        { ALT: () => $.SUBRULE($.charExpr) },
        { ALT: () => $.CONSUME(EnumValue) },
        { ALT: () => $.SUBRULE($.setExpr) },
        { ALT: () => $.SUBRULE($.seqExpr) },
        { ALT: () => $.SUBRULE($.mapExpr) },
        { ALT: () => $.SUBRULE($.compositeExpr) },
        { ALT: () => $.SUBRULE($.productExpr) },
        { ALT: () => $.SUBRULE($.compositeOrProductExpr) },
        { ALT: () => $.SUBRULE($.generalExpr) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.expression); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('numberExpr', () => {
      $.SUBRULE($.subNumber1)
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Plus) },
          { ALT: () => $.CONSUME(Minus) }
        ])
        $.SUBRULE2($.subNumber1)
      })
    })

    $.RULE('subNumber1', () => {
      $.SUBRULE($.subNumber2)
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Star) },
          { ALT: () => $.CONSUME(Slash) },
          { ALT: () => $.CONSUME(Div) },
          { ALT: () => $.CONSUME(Rem) },
          { ALT: () => $.CONSUME(Mod) }
        ])
        $.SUBRULE2($.subNumber2)
      })
    })

    $.RULE('subNumber2', () => {
      $.SUBRULE($.subNumber3)
      $.MANY(() => {
        $.CONSUME(PowerOp)
        $.SUBRULE2($.subNumber3)
      })
    })

    $.RULE('subNumber3', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.number) },
        { ALT: () => { $.CONSUME(Minus); $.SUBRULE($.numberExpr) } },
        { ALT: () => $.SUBRULE($.numberApply) },
        { ALT: () => $.SUBRULE($.generalExpr) }
      ])
    })

    $.RULE('numberApply', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Abs); $.CONSUME(LParen); $.SUBRULE($.numberExpr); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Floor); $.CONSUME1(LParen); $.SUBRULE1($.numberExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME(Card); $.CONSUME2(LParen); $.SUBRULE($.setExpr); $.CONSUME2(RParen) } },
        { ALT: () => { $.CONSUME(Len); $.CONSUME3(LParen); $.SUBRULE($.seqExpr); $.CONSUME3(RParen) } }
      ])
    })

    $.RULE('charExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.charValue) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.charExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('setExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.setConstructor) },
        { ALT: () => $.SUBRULE($.setApply) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.setExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('setConstructor', () => {
      $.CONSUME(LBrace)
      $.OR([
        { ALT: () => { $.CONSUME(RBrace) } },
        { ALT: () => { $.SUBRULE($.expressionList); $.CONSUME1(RBrace) } },
        {
          ALT: () => {
            $.SUBRULE($.numberExpr)
            $.CONSUME(Comma)
            $.CONSUME(Ellipsis)
            $.CONSUME1(Comma)
            $.SUBRULE1($.numberExpr)
            $.CONSUME2(RBrace)
          }
        },
        {
          ALT: () => {
            $.SUBRULE($.expression)
            $.CONSUME(Pipe)
            $.SUBRULE($.predicate)
            $.CONSUME3(RBrace)
          }
        },
        {
          ALT: () => {
            $.SUBRULE1($.expression)
            $.CONSUME1(Pipe)
            $.SUBRULE($.bindingList)
            $.CONSUME(Amp)
            $.SUBRULE1($.predicate)
            $.CONSUME4(RBrace)
          }
        }
      ])
    })

    $.RULE('setApply', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Union); $.CONSUME(LParen); $.SUBRULE($.setExpr); $.CONSUME(Comma); $.SUBRULE1($.setExpr); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Inter); $.CONSUME1(LParen); $.SUBRULE2($.setExpr); $.CONSUME1(Comma); $.SUBRULE3($.setExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME(Diff); $.CONSUME2(LParen); $.SUBRULE4($.setExpr); $.CONSUME2(Comma); $.SUBRULE5($.setExpr); $.CONSUME2(RParen) } },
        { ALT: () => { $.CONSUME(Dunion); $.CONSUME3(LParen); $.SUBRULE6($.setExpr); $.CONSUME3(RParen) } },
        { ALT: () => { $.CONSUME(Dinter); $.CONSUME4(LParen); $.SUBRULE7($.setExpr); $.CONSUME4(RParen) } },
        { ALT: () => { $.CONSUME(Power); $.CONSUME5(LParen); $.SUBRULE8($.setExpr); $.CONSUME5(RParen) } },
        { ALT: () => { $.CONSUME(Elems); $.CONSUME6(LParen); $.SUBRULE($.seqExpr); $.CONSUME6(RParen) } },
        { ALT: () => { $.CONSUME(Inds); $.CONSUME7(LParen); $.SUBRULE1($.seqExpr); $.CONSUME7(RParen) } },
        { ALT: () => { $.CONSUME(Dom); $.CONSUME8(LParen); $.SUBRULE($.mapExpr); $.CONSUME8(RParen) } },
        { ALT: () => { $.CONSUME(Rng); $.CONSUME9(LParen); $.SUBRULE1($.mapExpr); $.CONSUME9(RParen) } }
      ])
    })

    $.RULE('seqExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.seqConstructor) },
        { ALT: () => $.SUBRULE($.seqApply) },
        { ALT: () => $.SUBRULE($.stringValue) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.seqExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('seqConstructor', () => {
      $.CONSUME(LBracket)
      $.OR([
        { ALT: () => { $.CONSUME(RBracket) } },
        { ALT: () => { $.SUBRULE($.expressionList); $.CONSUME1(RBracket) } },
        {
          ALT: () => {
            $.SUBRULE($.numberExpr)
            $.CONSUME(Comma)
            $.CONSUME(Ellipsis)
            $.CONSUME1(Comma)
            $.SUBRULE1($.numberExpr)
            $.CONSUME2(RBracket)
          }
        },
        {
          ALT: () => {
            $.SUBRULE($.expression)
            $.CONSUME(Pipe)
            $.SUBRULE($.predicate)
            $.CONSUME3(RBracket)
          }
        },
        {
          ALT: () => {
            $.SUBRULE1($.expression)
            $.CONSUME1(Pipe)
            $.SUBRULE($.bindingList)
            $.CONSUME(Amp)
            $.SUBRULE1($.predicate)
            $.CONSUME4(RBracket)
          }
        }
      ])
    })

    $.RULE('seqApply', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Tl); $.CONSUME(LParen); $.SUBRULE($.seqExpr); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Conc); $.CONSUME1(LParen); $.SUBRULE1($.seqExpr); $.CONSUME(Comma); $.SUBRULE2($.seqExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME(Dconc); $.CONSUME2(LParen); $.SUBRULE3($.seqExpr); $.CONSUME2(RParen) } }
      ])
    })

    $.RULE('mapExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.mapConstructor) },
        { ALT: () => $.SUBRULE($.mapApply) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.mapExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('mapConstructor', () => {
      $.CONSUME(LBrace)
      $.OR([
        { ALT: () => { $.CONSUME(Arrow); $.CONSUME(RBrace) } },
        {
          ALT: () => {
            $.SUBRULE($.expression)
            $.CONSUME1(Arrow)
            $.SUBRULE1($.expression)
            $.MANY(() => {
              $.CONSUME(Comma)
              $.SUBRULE2($.expression)
              $.CONSUME2(Arrow)
              $.SUBRULE3($.expression)
            })
            $.CONSUME1(RBrace)
          }
        },
        {
          ALT: () => {
            $.SUBRULE4($.expression)
            $.CONSUME3(Arrow)
            $.SUBRULE5($.expression)
            $.CONSUME(Pipe)
            $.SUBRULE($.predicate)
            $.CONSUME2(RBrace)
          }
        },
        {
          ALT: () => {
            $.SUBRULE6($.expression)
            $.CONSUME4(Arrow)
            $.SUBRULE7($.expression)
            $.CONSUME1(Pipe)
            $.SUBRULE($.bindingList)
            $.CONSUME(Amp)
            $.SUBRULE1($.predicate)
            $.CONSUME3(RBrace)
          }
        }
      ])
    })

    $.RULE('mapApply', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Domrt); $.CONSUME(LParen); $.SUBRULE($.setExpr); $.CONSUME(Comma); $.SUBRULE($.mapExpr); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Rngrt); $.CONSUME1(LParen); $.SUBRULE1($.mapExpr); $.CONSUME1(Comma); $.SUBRULE1($.setExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME(Domrb); $.CONSUME2(LParen); $.SUBRULE2($.setExpr); $.CONSUME2(Comma); $.SUBRULE2($.mapExpr); $.CONSUME2(RParen) } },
        { ALT: () => { $.CONSUME(Rngrb); $.CONSUME3(LParen); $.SUBRULE3($.mapExpr); $.CONSUME3(Comma); $.SUBRULE3($.setExpr); $.CONSUME3(RParen) } },
        { ALT: () => { $.CONSUME(Override); $.CONSUME4(LParen); $.SUBRULE4($.mapExpr); $.CONSUME4(Comma); $.SUBRULE5($.mapExpr); $.CONSUME4(RParen) } },
        { ALT: () => { $.CONSUME(Inverse); $.CONSUME5(LParen); $.SUBRULE6($.mapExpr); $.CONSUME5(RParen) } },
        { ALT: () => { $.CONSUME(Comp); $.CONSUME6(LParen); $.SUBRULE7($.mapExpr); $.CONSUME5(Comma); $.SUBRULE8($.mapExpr); $.CONSUME6(RParen) } }
      ])
    })

    $.RULE('compositeOrProductExpr', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Mk); $.SUBRULE($.moduleOrFieldAccess); $.CONSUME(LParen); $.OPTION(() => $.SUBRULE($.expressionList)); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME1(LParen); $.SUBRULE($.compositeOrProductExpr); $.CONSUME1(RParen) } }
      ])
    })

    $.RULE('compositeExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.compositeApply) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.compositeExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('compositeApply', () => {
      $.CONSUME(Modify)
      $.CONSUME(LParen)
      $.SUBRULE($.expression)
      $.CONSUME(Comma)
      $.SUBRULE($.modifyingFieldList)
      $.CONSUME(RParen)
    })

    $.RULE('modifyingFieldList', () => {
      $.CONSUME(Identifier)
      $.CONSUME(Arrow)
      $.SUBRULE($.expression)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME2(Identifier)
        $.CONSUME1(Arrow)
        $.SUBRULE2($.expression)
      })
    })

    $.RULE('productExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.productApply) },
        { ALT: () => { $.CONSUME(LParen); $.SUBRULE($.productExpr); $.CONSUME(RParen) } }
      ])
    })

    $.RULE('productApply', () => {
      $.CONSUME(Modify)
      $.CONSUME(LParen)
      $.SUBRULE($.expression)
      $.CONSUME(Comma)
      $.SUBRULE($.modifyingValueList)
      $.CONSUME(RParen)
    })

    $.RULE('modifyingValueList', () => {
      $.CONSUME(IntegerLiteral)
      $.CONSUME(Arrow)
      $.SUBRULE($.expression)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME1(IntegerLiteral)
        $.CONSUME1(Arrow)
        $.SUBRULE2($.expression)
      })
    })

    $.RULE('generalExpr', () => {
      $.SUBRULE($.generalAtom)
      $.MANY(() => {
        $.SUBRULE($.generalPostfix)
      })
    })

    $.RULE('generalAtom', () => {
      $.OR([
        { ALT: () => $.CONSUME(Nil) },
        { ALT: () => $.SUBRULE($.simpleVariable) },
        { ALT: () => $.SUBRULE($.compoundExpr) },
        { ALT: () => { $.CONSUME(Get); $.CONSUME(LParen); $.SUBRULE($.setExpr); $.CONSUME(RParen) } },
        { ALT: () => { $.CONSUME(Hd); $.CONSUME1(LParen); $.SUBRULE1($.seqExpr); $.CONSUME1(RParen) } },
        { ALT: () => { $.CONSUME2(LParen); $.SUBRULE($.generalExpr); $.CONSUME2(RParen) } }
      ])
    })

    $.RULE('generalPostfix', () => {
      $.OR([
        { ALT: () => { $.CONSUME(Dot); $.CONSUME(Identifier) } },
        { ALT: () => { $.CONSUME3(LParen); $.OPTION(() => $.SUBRULE($.expressionList)); $.CONSUME3(RParen) } }
      ])
    })
    $.RULE('simpleVariable', () => {
      $.OPTION(() => $.CONSUME(Tilde))
      $.CONSUME(Identifier)
    })

    $.RULE('compoundExpr', () => {
      $.OR([
        { ALT: () => $.SUBRULE($.ifExpr) },
        { ALT: () => $.SUBRULE($.letExpr) },
        { ALT: () => $.SUBRULE($.caseExpr) }
      ])
    })

    $.RULE('ifExpr', () => {
      $.CONSUME(If)
      $.SUBRULE($.predicate)
      $.CONSUME(Then)
      $.SUBRULE($.expression)
      $.CONSUME(Else)
      $.SUBRULE1($.expression)
    })

    $.RULE('letExpr', () => {
      $.CONSUME(Let)
      $.SUBRULE($.patternDef)
      $.CONSUME(In)
      $.SUBRULE($.expression)
    })

    $.RULE('patternDef', () => {
      $.OR([
        {
          ALT: () => {
            $.CONSUME(Identifier)
            $.CONSUME(Equals)
            $.SUBRULE($.expression)
            $.MANY(() => {
              $.CONSUME(Comma)
              $.CONSUME2(Identifier)
              $.CONSUME1(Equals)
              $.SUBRULE2($.expression)
            })
          }
        },
        {
          ALT: () => {
            $.CONSUME3(Identifier)
            $.CONSUME(Colon)
            $.SUBRULE($.typeExpr)
            $.OPTION(() => {
              $.CONSUME(Pipe)
              $.SUBRULE($.predicate)
            })
          }
        }
      ])
    })

    $.RULE('caseExpr', () => {
      $.CONSUME(Case)
      $.SUBRULE($.expression)
      $.CONSUME(OfKw)
      $.SUBRULE($.caseAlternatives)
      $.OPTION(() => {
        $.CONSUME(Semicolon)
        $.SUBRULE($.defaultExpr)
      })
      $.CONSUME(EndCase)
    })

    $.RULE('caseAlternatives', () => {
      $.SUBRULE($.caseAlt)
      $.MANY(() => {
        $.CONSUME(Semicolon)
        $.SUBRULE2($.caseAlt)
      })
    })

    $.RULE('caseAlt', () => {
      $.CONSUME(Identifier)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.CONSUME2(Identifier)
      })
      $.CONSUME(Arrow)
      $.SUBRULE($.expression)
    })

    $.RULE('defaultExpr', () => {
      $.CONSUME(Default)
      $.CONSUME(Arrow)
      $.SUBRULE($.expression)
    })

    $.RULE('expressionList', () => {
      $.SUBRULE($.expression)
      $.MANY(() => {
        $.CONSUME(Comma)
        $.SUBRULE2($.expression)
      })
    })

    this.performSelfAnalysis()
  }
}

export const parserInstance = new AgileSoflParser()
