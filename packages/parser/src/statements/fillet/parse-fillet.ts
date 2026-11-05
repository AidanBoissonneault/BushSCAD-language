/** Parses fillet call arguments into the fillet AST node. */

import type { FilletDetail } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

import { parseDetailCallArgs } from '../details/parse-detail-call-args.js';

/**
 * Parses fillet from the supplied source into the statements representation.
 */
export function parseFillet(p: Parser): FilletDetail {
  const start = p.peek().span;
  p.advance(); // FILLET
  p.expect('LPAREN', 'Use fillet(@target, radius)');
  const { target, value: radius } = parseDetailCallArgs(p, 'fillet', 'radius');
  p.expect('RPAREN');
  p.requireSemi();
  return { kind: 'fillet', target, radius, span: p.spanFrom(start) };
}
