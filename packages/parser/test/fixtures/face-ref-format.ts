/**
 * @author Aidan Boissonneault
 * @file face-ref-format.ts
 * @purpose Tests face ref format behavior in the fixtures in parser package.
 * @last-edited October 6, 2026
 */

import type { FaceRef, RepeatableFaceRef } from '@bushscad/ir';

/**
 * Formats a face reference chain into the compact notation used by parser tests.
 *
 * Why:
 * Parser assertions compare syntax-level face ref structure, not resolved face
 * semantics, so this intentionally preserves the parsed chain shape.
 */
export function faceChain(ref: FaceRef | RepeatableFaceRef): string {
  if (ref.kind === 'faceRefList') return '<list>';
  return ref.chain.map(faceRefSegment).join('.');
}

/**
 * Resolves the face data required by the current selector.
 */
function faceRefSegment(
  segment: Exclude<
    FaceRef | RepeatableFaceRef,
    { kind: 'faceRefList' }
  >['chain'][number],
): string {
  if (segment.kind === 'call') return `${segment.name}(${segment.arg})`;
  if (segment.kind === 'edgeIntersection') {
    const suffix = segment.index === undefined ? '' : `[${segment.index}]`;
    return `(${segment.edges.join(',')})${suffix}`;
  }
  if (segment.kind === 'group') return `[${segment.options.join(',')}]`;
  if (segment.kind === 'wildcard') return '*';
  return String(segment.value);
}
