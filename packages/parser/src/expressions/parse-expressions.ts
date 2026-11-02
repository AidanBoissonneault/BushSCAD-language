/**
 * @author Aidan Boissonneault
 * @file parse-expressions.ts
 * @purpose Parses expressions for the expressions in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, BinaryExpr, UnaryExpr } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parsePrimary } from './parse-primary.js';

/** Entry point for expression parsing — delegates to precedence chain. */
export function parseTernary(p: Parser): Expr {
  const start = p.peek().span;
  const cond = parseOr(p);
  if (p.eat('QUESTION')) {
    const then = parseOr(p);
    p.expect('COLON');
    const else_ = parseTernary(p);
    return {
      kind: 'ternary',
      condition: cond,
      then,
      else: else_,
      span: p.spanFrom(start),
    };
  }
  return cond;
}

/**
 * Parses or from the supplied source into the expressions representation.
 */
function parseOr(p: Parser): Expr {
  let left = parseAnd(p);
  while (p.eat('OR')) {
    const right = parseAnd(p);
    left = binaryExpr(p, left, '||', right);
  }
  return left;
}

/**
 * Parses and from the supplied source into the expressions representation.
 */
function parseAnd(p: Parser): Expr {
  let left = parseEquality(p);
  while (p.eat('AND')) {
    const right = parseEquality(p);
    left = binaryExpr(p, left, '&&', right);
  }
  return left;
}

/**
 * Parses equality from the supplied source into the expressions representation.
 */
function parseEquality(p: Parser): Expr {
  let left = parseComparison(p);
  for (;;) {
    if (p.eat('EQ')) {
      left = binaryExpr(p, left, '==', parseComparison(p));
      continue;
    }
    if (p.eat('NEQ')) {
      left = binaryExpr(p, left, '!=', parseComparison(p));
      continue;
    }
    break;
  }
  return left;
}

/**
 * Parses comparison from the supplied source into the expressions representation.
 */
function parseComparison(p: Parser): Expr {
  let left = parseAddSub(p);
  for (;;) {
    if (p.eat('LT')) {
      left = binaryExpr(p, left, '<', parseAddSub(p));
      continue;
    }
    if (p.eat('GT')) {
      left = binaryExpr(p, left, '>', parseAddSub(p));
      continue;
    }
    if (p.eat('LTE')) {
      left = binaryExpr(p, left, '<=', parseAddSub(p));
      continue;
    }
    if (p.eat('GTE')) {
      left = binaryExpr(p, left, '>=', parseAddSub(p));
      continue;
    }
    break;
  }
  return left;
}

/**
 * Parses add sub from the supplied source into the expressions representation.
 */
function parseAddSub(p: Parser): Expr {
  let left = parseMulDiv(p);
  for (;;) {
    if (p.eat('PLUS')) {
      left = binaryExpr(p, left, '+', parseMulDiv(p));
      continue;
    }
    if (p.eat('MINUS')) {
      left = binaryExpr(p, left, '-', parseMulDiv(p));
      continue;
    }
    break;
  }
  return left;
}

/**
 * Parses mul div from the supplied source into the expressions representation.
 */
function parseMulDiv(p: Parser): Expr {
  let left = parseUnary(p);
  for (;;) {
    if (p.eat('STAR')) {
      left = binaryExpr(p, left, '*', parseUnary(p));
      continue;
    }
    if (p.eat('SLASH')) {
      left = binaryExpr(p, left, '/', parseUnary(p));
      continue;
    }
    if (p.eat('PERCENT')) {
      left = binaryExpr(p, left, '%', parseUnary(p));
      continue;
    }
    break;
  }
  return left;
}

/**
 * Parses unary from the supplied source into the expressions representation.
 */
function parseUnary(p: Parser): Expr {
  const t = p.peek();
  if (p.eat('MINUS')) {
    return {
      kind: 'unary',
      op: '-',
      operand: parseUnary(p),
      span: p.spanFrom(t.span),
    } as UnaryExpr;
  }
  if (p.eat('BANG')) {
    return {
      kind: 'unary',
      op: '!',
      operand: parseUnary(p),
      span: p.spanFrom(t.span),
    } as UnaryExpr;
  }
  return parsePrimary(p);
}

/** Builds a binary node after its right operand so the span covers the full expression. */
function binaryExpr(
  p: Parser,
  left: Expr,
  op: BinaryExpr['op'],
  right: Expr,
): BinaryExpr {
  return { kind: 'binary', op, left, right, span: p.spanFrom(left.span) };
}
