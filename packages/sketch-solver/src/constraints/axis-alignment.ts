/**
 * @author Aidan Boissonneault
 * @file axis-alignment.ts
 * @purpose Provides axis alignment behavior for the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import type { SolverConstraint } from '../types/types.js';
import type { ConstraintAccess } from './constraint-access.js';
import type { ConstraintSegmentPoints } from './constraint-geometry.js';

/**
 * Applies unary segment orientation or binary point alignment on one axis.
 * Horizontal and vertical share a public constraint kind for both forms. The
 * optional reference distinguishes a point-pair relationship from an oriented
 * segment while keeping their residual semantics in one place.
 */
export function appendAxisAlignment(
  out: number[],
  constraint: SolverConstraint,
  target: ConstraintSegmentPoints | null,
  access: ConstraintAccess,
  coordinate: 0 | 1,
): void {
  if (constraint.ref) {
    const point = access.point(constraint.target);
    const reference = access.point(constraint.ref);
    out.push(point[coordinate] - reference[coordinate]);
    return;
  }
  if (target) out.push(target[0][coordinate] - target[1][coordinate]);
}
