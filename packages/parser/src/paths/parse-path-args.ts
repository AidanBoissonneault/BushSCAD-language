/**
 * @author Aidan Boissonneault
 * @file parse-path-args.ts
 * @purpose Parses path args for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/** Parses a comma-separated expression list up to the current call close. */
export function parseExprList(p: Parser): Expr[] {
  const args: Expr[] = [];
  while (!p.check('RPAREN', 'EOF')) {
    args.push(p.parseExpr());
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/** Creates a numeric zero point used after a path argument parse diagnostic. */
export function missingPoint(p: Parser): [Expr, Expr] {
  const span = p.peek().span;
  return [
    { kind: 'number', value: 0, span },
    { kind: 'number', value: 0, span },
  ];
}
