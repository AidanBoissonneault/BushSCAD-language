/** Shared value and segment access for residual calculations. */
import { type ConstraintSegmentPoints as SegmentPoints } from '../constraint-geometry.js';
import type { SolverConstraint, SolverDimension } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import { evaluateSolverScalar } from '../constraint-values.js';

/**
 * Creates a segment from its endpoint coordinates.
 */
export function segmentPair(
  constraint: SolverConstraint,
  access: ConstraintAccess,
): [SegmentPoints, SegmentPoints] | null {
  if (!constraint.ref) return null;
  const target = access.segment(constraint.target);
  const reference = access.segment(constraint.ref);
  return target && reference ? [target, reference] : null;
}

/**
 * Handles constraint value in the constraints flow.
 */
export function constraintValue(
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): number | undefined {
  return constraint.value === undefined
    ? undefined
    : evaluateSolverScalar(constraint.value, dimensions, access);
}

/**
 * Builds the axis data required by the current operation.
 */
export function axisReferenceAngle(ref: string): number | null {
  if (ref === 'origin.x_axis') return 0;
  if (ref === 'origin.y_axis') return Math.PI / 2;
  return null;
}
