/**
 * @author Aidan Boissonneault
 * @file reference-expansion.ts
 * @purpose Provides reference expansion behavior for the references in IR package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  FaceRefList,
  FaceRefSegment,
  RepeatableFaceRef,
  RepeatableSpatialRef,
  SpatialRef,
} from '../ast/expressions.js';

/**
 * Expands grouped face-reference segments into concrete references.
 * Source selectors such as `@[body1, body2].[top, bottom]` are language sugar
 * over repeated existing operations. Keeping the Cartesian product here gives
 * every compiler layer the same ordering and semantics.
 */
export function expandFaceRef(ref: FaceRef): FaceRef[] {
  const chains = expandSegments(ref.chain);
  return chains.map((chain) => ({ ...ref, chain }));
}

/**
 * Expands either one face reference or an explicit selector list.
 * `[@a, @b].top` needs the list suffix applied before grouped segment
 * expansion, while a plain `@a.[top,bottom]` only needs group expansion.
 */
export function expandRepeatableFaceRef(ref: RepeatableFaceRef): FaceRef[] {
  if (ref.kind === 'faceRef') return expandFaceRef(ref);
  return ref.items.flatMap((item) =>
    expandFaceRef({ ...item, chain: [...item.chain, ...ref.suffix] }),
  );
}

/**
 * Expands a placement-like reference without changing positional offsets.
 * Placement arrays repeat the surrounding operation, but each concrete
 * placement should preserve the original offset/radius/angle arguments.
 */
export function expandRepeatableSpatialRef(
  ref: RepeatableSpatialRef,
): SpatialRef[] {
  if (ref.kind === 'faceRef' || ref.kind === 'faceRefList') {
    return expandRepeatableFaceRef(ref);
  }
  if (Array.isArray(ref.anchor)) return [ref];
  return expandFaceRef(ref.anchor).map((anchor) => ({ ...ref, anchor }));
}

/**
 * Returns whether the input meets the `face ref list` condition.
 */
export function isFaceRefList(ref: unknown): ref is FaceRefList {
  return (
    typeof ref === 'object' &&
    ref !== null &&
    (ref as { kind?: unknown }).kind === 'faceRefList'
  );
}

/**
 * Expands segments into its concrete entries.
 */
function expandSegments(segments: FaceRefSegment[]): FaceRefSegment[][] {
  let chains: FaceRefSegment[][] = [[]];
  for (const segment of segments) {
    if (segment.kind === 'group') {
      chains = chains.flatMap((chain) =>
        segment.options.map((value, index): FaceRefSegment[] => [
          ...chain,
          {
            kind: 'name',
            value,
            span: segment.memberSpans[index] ?? segment.span,
            expandedFrom: segment.delimiterSpan,
          },
        ]),
      );
    } else {
      chains = chains.map((chain) => [...chain, segment]);
    }
  }
  return chains;
}
