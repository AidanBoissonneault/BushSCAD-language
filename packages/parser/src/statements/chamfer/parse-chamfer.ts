/** Parses chamfer call arguments into the chamfer AST node. */

import type { ChamferDetail } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

import { parseDetailCallArgs } from '../details/parse-detail-call-args.js';

/**
 * Parses chamfer from the supplied source into the statements representation.
 */
export function parseChamfer(p: Parser): ChamferDetail {
  const start = p.peek().span;
  p.advance(); // CHAMFER
  p.expect('LPAREN', 'Use chamfer(@target, offset)');
  const { target, value: offset } = parseDetailCallArgs(p, 'chamfer', 'offset');
  p.expect('RPAREN');
  p.requireSemi();
  return { kind: 'chamfer', target, offset, span: p.spanFrom(start) };
}
