/**
 * @author Aidan Boissonneault
 * @file parse-declarations.ts
 * @purpose Parses declarations for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  VarDecl,
  EnvDecl,
  FontImportDecl,
  ShapeImportDecl,
  HealDecl,
  DefeatureDecl,
  Literal,
  Expr,
} from '@bushscad/ir';
import type { Token } from '../core/token-types.js';
import type { Parser } from '../core/parser.js';
import { isNameToken } from '../expressions/parse-names.js';

/**
 * Parses var from the supplied source into the statements representation.
 */
export function parseVar(p: Parser): VarDecl {
  const start = p.peek().span;
  p.advance(); // VAR
  const name = p.expect('IDENT').value;
  p.expect('ASSIGN');
  const value = p.parseExpr();
  p.eatSemi();
  return { kind: 'var', name, value, span: p.spanFrom(start) };
}

/**
 * Parses env from the supplied source into the statements representation.
 */
export function parseEnv(p: Parser): EnvDecl {
  const start = p.peek().span;
  p.advance(); // ENV
  const name = p.expect('IDENT').value;
  p.expect('FALLBACK');
  const fallback = parseLiteral(p);
  p.eatSemi();
  return { kind: 'env', name, fallback, span: p.spanFrom(start) };
}

/**
 * Returns whether the input meets the `font import start` condition.
 */
export function isFontImportStart(p: Parser, offset = 0): boolean {
  return (
    p.peek(offset).kind === 'IDENT' &&
    p.peek(offset).value === 'font' &&
    p.peek(offset + 1).kind === 'IDENT' &&
    p.peek(offset + 2).kind === 'ASSIGN' &&
    p.peek(offset + 3).kind === 'IMPORT'
  );
}

/**
 * Parses font import from the supplied source into the statements representation.
 */
export function parseFontImport(p: Parser): FontImportDecl {
  const start = p.peek().span;
  p.advance(); // font
  const name = p.expect('IDENT').value;
  p.expect('ASSIGN');
  p.expect('IMPORT');
  const path = p.expect('STRING').value;
  p.eatSemi();
  return { kind: 'fontImport', name, path, span: p.spanFrom(start) };
}

// import shape name = './path.step';
/**
 * Returns whether the input meets the `shape import start` condition.
 */
export function isShapeImportStart(p: Parser, offset = 0): boolean {
  return (
    p.peek(offset).kind === 'IMPORT' &&
    p.peek(offset + 1).kind === 'IDENT' &&
    p.peek(offset + 1).value === 'shape' &&
    p.peek(offset + 2).kind === 'IDENT' &&
    p.peek(offset + 3).kind === 'ASSIGN'
  );
}

/**
 * Parses shape import from the supplied source into the statements representation.
 */
export function parseShapeImport(p: Parser): ShapeImportDecl {
  const start = p.peek().span;
  p.advance(); // IMPORT
  p.advance(); // shape
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  p.expect('ASSIGN');
  const path = p.expect('STRING').value;
  p.eatSemi();
  return {
    kind: 'shapeImport',
    name,
    nameSpan: nameToken.span,
    path,
    span: p.spanFrom(start),
  };
}

// heal name tolerance: <expr>;
/**
 * Returns whether the input meets the `heal start` condition.
 */
export function isHealStart(p: Parser, offset = 0): boolean {
  return (
    p.peek(offset).kind === 'IDENT' &&
    p.peek(offset).value === 'heal' &&
    p.peek(offset + 1).kind === 'IDENT'
  );
}

/**
 * Parses heal from the supplied source into the statements representation.
 */
export function parseHeal(p: Parser): HealDecl {
  const start = p.peek().span;
  p.advance(); // heal
  let target: string | undefined;
  if (p.peek().value !== 'tolerance') {
    target = p.expect('IDENT').value;
  }
  const tolTok = p.advance();
  if (tolTok.value !== 'tolerance')
    p.addError(`Expected 'tolerance'`, tolTok.span);
  p.expect('COLON');
  const tolerance = p.parseExpr();
  p.eatSemi();
  return { kind: 'heal', target, tolerance, span: p.spanFrom(start) };
}

// defeature name holes|pockets smaller_than: <expr>;
/**
 * Returns whether the input meets the `defeature start` condition.
 */
export function isDefeatureStart(p: Parser, offset = 0): boolean {
  return (
    p.peek(offset).kind === 'IDENT' &&
    p.peek(offset).value === 'defeature' &&
    p.peek(offset + 1).kind === 'IDENT'
  );
}

/**
 * Parses defeature from the supplied source into the statements representation.
 */
export function parseDefeature(p: Parser): DefeatureDecl {
  const start = p.peek().span;
  p.advance(); // defeature
  let target: string | undefined;
  const nextVal = p.peek().value;
  if (nextVal !== 'holes' && nextVal !== 'pockets') {
    target = p.expect('IDENT').value;
  }
  const ftTok = p.advance();
  const featureType: DefeatureDecl['featureType'] =
    ftTok.value === 'pockets' ? 'pockets' : 'holes';
  // `smaller_than` is a soft keyword represented by an identifier token.
  const kw = p.advance();
  if (kw.value !== 'smaller_than') {
    p.addError(`Expected 'smaller_than', got '${kw.value}'`, kw.span);
  }
  p.expect('COLON');
  const threshold = p.parseExpr();
  p.eatSemi();
  return {
    kind: 'defeature',
    target,
    featureType,
    threshold,
    span: p.spanFrom(start),
  };
}

/**
 * Parses literal from the supplied source into the statements representation.
 */
function parseLiteral(p: Parser): Literal {
  const t = p.peek();
  if (t.kind === 'NUMBER') {
    p.advance();
    return { kind: 'number', value: parseFloat(t.value), span: t.span };
  }
  if (t.kind === 'STRING') {
    p.advance();
    return { kind: 'string', value: t.value, span: t.span };
  }
  if (t.kind === 'BOOL') {
    p.advance();
    return { kind: 'bool', value: t.value === 'true', span: t.span };
  }
  if (t.kind === 'LBRACKET') {
    const list = parseListLiteral(p);
    if (list.kind === 'list') {
      for (const item of list.items) {
        const unsupported = firstUnsupportedEnvListValue(item);
        if (unsupported) {
          p.addError(
            'Environment fallback lists may contain only literal values',
            unsupported.span,
          );
        }
      }
    }
    return list;
  }
  p.fail(`Expected literal, got ${t.kind}`, t.span);
}

/** Finds a non-literal value before env lists reach typed manifest conversion. */
function firstUnsupportedEnvListValue(expr: Expr): Expr | null {
  if (
    expr.kind === 'number' ||
    expr.kind === 'string' ||
    expr.kind === 'bool'
  ) {
    return null;
  }
  if (expr.kind !== 'list') return expr;
  for (const item of expr.items) {
    const unsupported = firstUnsupportedEnvListValue(item);
    if (unsupported) return unsupported;
  }
  return null;
}

/**
 * Parses list literal from the supplied source into the statements representation.
 */
export function parseListLiteral(p: Parser): Literal {
  const start = p.advance().span;
  const items: Expr[] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    items.push(p.parseExpr());
    p.eat('COMMA');
  }
  p.expect('RBRACKET');
  return { kind: 'list', items, span: p.spanFrom(start) };
}

/**
 * Parses named expr arg from the supplied source into the statements representation.
 */
export function parseNamedExprArg(
  p: Parser,
): [name: string, value: Expr] | null {
  if (!isNamedArgToken(p.peek()) || p.peek(1).kind !== 'COLON') return null;
  const name = p.advance().value;
  p.advance(); // COLON
  return [name, p.parseExpr()];
}

/**
 * Returns whether the input meets the `named arg token` condition.
 */
export function isNamedArgToken(token: Token): boolean {
  return isNameToken(token);
}

/**
 * Parses angle expr from the supplied source into the statements representation.
 */
export function parseAngleExpr(p: Parser): Expr {
  if (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'angle' &&
    p.peek(1).kind === 'LPAREN'
  ) {
    p.advance();
    p.expect('LPAREN');
    const angle = p.parseExpr();
    p.expect('RPAREN');
    return angle;
  }
  return p.parseExpr();
}
