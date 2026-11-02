/**
 * @author Aidan Boissonneault
 * @file parse-sketch-points.ts
 * @purpose Parses sketch points for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Parses a two-coordinate sketch point tuple.
 * Path segments, sketch dimensions, and placement expressions share this
 * tuple shape and must reject divergent point syntax consistently.
 */
export function parsePointTuple2(p: Parser): [Expr, Expr] {
  p.expect('LPAREN');
  const x = p.parseExpr();
  p.expect('COMMA');
  const y = p.parseExpr();
  p.expect('RPAREN');
  return [x, y];
}
