/**
 * @author Aidan Boissonneault
 * @file parse-wrap.ts
 * @purpose Parses wrap for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { RepeatableSpatialRef } from '@bushscad/ir';
import { expandRepeatableSpatialRef } from '@bushscad/ir';

/**
 * Reads the inline `wrap` placement marker from a face placement.
 * The public syntax attaches wrapping to `@body.curved(angle, wrap)`, while the
 * existing evaluator and bridge intentionally keep wrap on the operation.
 */
export function placementRequestsWrap(
  from: RepeatableSpatialRef | null,
): boolean {
  if (!from) return false;
  return expandRepeatableSpatialRef(from).some((target) =>
    target.kind === 'faceRef'
      ? target.wrap === true
      : !Array.isArray(target.anchor) && target.anchor.wrap === true,
  );
}
