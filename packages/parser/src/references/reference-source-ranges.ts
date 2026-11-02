/**
 * @author Aidan Boissonneault
 * @file reference-source-ranges.ts
 * @purpose Provides reference source ranges behavior for the references in parser package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, FaceRefSegment } from '@bushscad/ir';
import type { Token } from '../core/token-types.js';

/** Creates a source-complete name segment from its identifier token. */
export function referenceNameSegment(
  token: Token,
): Extract<FaceRefSegment, { kind: 'name' }> {
  return { kind: 'name', value: token.value, span: token.span };
}

/**
 * Creates a source-complete group selector from its brackets and members.
 *
 * The whole delimiter range owns punctuation and whitespace while each member
 * retains its identifier range for member-specific hover and diagnostics.
 */
export function referenceGroupSegment(
  delimiterSpan: ASTSourceSpan,
  members: Token[],
): Extract<FaceRefSegment, { kind: 'group' }> {
  return {
    kind: 'group',
    options: members.map((member) => member.value),
    memberSpans: members.map((member) => member.span),
    delimiterSpan,
    span: delimiterSpan,
  };
}

/** Combines a starting and ending token range without parser cursor state. */
export function referenceSpan(
  start: ASTSourceSpan,
  end: ASTSourceSpan,
): ASTSourceSpan {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    endLine: end.endLine,
    endCol: end.endCol,
  };
}
