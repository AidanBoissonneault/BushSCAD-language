/** Parses draft call arguments into the draft AST node. */

import type { DraftDetail } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

import { parseDetailCallArgs } from '../details/parse-detail-call-args.js';

/**
 * Parses draft from the supplied source into the statements representation.
 */
export function parseDraft(p: Parser): DraftDetail {
  const start = p.peek().span;
  p.advance(); // DRAFT
  p.expect('LPAREN', 'Use draft(@target.face, angle)');
  const { target, value: angle } = parseDetailCallArgs(p, 'draft', 'angle');
  p.expect('RPAREN');
  p.requireSemi();
  return { kind: 'draft', target, angle, span: p.spanFrom(start) };
}
