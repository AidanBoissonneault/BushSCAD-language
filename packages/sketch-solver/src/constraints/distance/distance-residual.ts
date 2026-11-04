import { distance } from '../constraint-geometry.js';
import { axisDistanceResidual } from '../axis-distance.js';
import type { SolverConstraint, SolverDimension } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import { constraintValue } from '../residual/residual-geometry.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends distance to the current output.
 */
function appendDistance(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): void {
  const value = constraintValue(constraint, access, dimensions);
  if (value === undefined || !constraint.ref) return;
  const target = access.point(constraint.target);
  const reference = access.point(constraint.ref);
  const axis = axisDistanceResidual(constraint, target, value, reference);
  out.push(axis ?? distance(target, reference) - value);
}

/** Resolves the distance constraint residual. */
export function appendDistanceResidual({
  out,
  constraint,
  access,
  dimensions,
}: ResidualContext): void {
  appendDistance(out, constraint, access, dimensions);
}
