/**
 * @author Aidan Boissonneault
 * @file parse-edge-intersection.ts
 * @purpose Parses edge intersection for the references in parser package.
 * @last-edited October 6, 2026
 */

import type { FaceRefSegment } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { referenceSpan } from './reference-source-ranges.js';

/**
 * Parses `(edge1, edge2)` and its optional result index inside an `@` selector.
 * Parentheses also represent numeric point tuples in expression context. This
 * parser is only entered after `@` or a reference dot, keeping the two forms
 * unambiguous while preserving the exact member and index source spans.
 */
export function parseEdgeIntersectionSegment(
  p: Parser,
): Extract<FaceRefSegment, { kind: 'edgeIntersection' }> {
  const start = p.expect('LPAREN');
  const first = parseIntersectionOperand(
    p,
    'Expected first named edge in intersection',
  );
  p.expect('COMMA', 'Expected comma between intersecting edge names');
  const second = parseIntersectionOperand(
    p,
    'Expected second named edge in intersection',
  );
  const end = p.expect('RPAREN');
  const delimiterSpan = referenceSpan(start.span, end.span);
  const indexed = parseOptionalIntersectionIndex(p);
  return {
    kind: 'edgeIntersection',
    edges: [first.value, second.value],
    memberSpans: [first.span, second.span],
    delimiterSpan,
    ...(indexed ?? {}),
    span: indexed?.indexSpan
      ? referenceSpan(start.span, indexed.indexSpan)
      : delimiterSpan,
  };
}

/**
 * Parses intersection operand from the supplied source into the references representation.
 */
function parseIntersectionOperand(
  p: Parser,
  message: string,
): { value: string; span: FaceRefSegment['span'] } {
  const first = p.expect('IDENT', message);
  const names = [first.value];
  let span = first.span;
  while (p.check('DOT') && p.peek(1).kind === 'IDENT') {
    p.advance();
    const member = p.advance();
    names.push(member.value);
    span = referenceSpan(first.span, member.span);
  }
  return { value: names.join('.'), span };
}

/**
 * Parses optional intersection index from the supplied source into the references representation.
 */
function parseOptionalIntersectionIndex(
  p: Parser,
): { index: number; indexSpan: FaceRefSegment['span'] } | null {
  if (!p.check('LBRACKET') || p.peek(1).kind !== 'NUMBER') return null;
  const start = p.advance();
  const value = p.expect('NUMBER', 'Expected numeric intersection index');
  const end = p.expect('RBRACKET');
  return {
    index: Math.trunc(Number(value.value)),
    indexSpan: referenceSpan(start.span, end.span),
  };
}
