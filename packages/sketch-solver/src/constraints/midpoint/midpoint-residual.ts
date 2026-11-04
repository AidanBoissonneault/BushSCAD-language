import type { SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends midpoint to the current output.
 */
function appendMidpoint(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
): void {
  if (!constraint.ref) return;
  const segment = access.segment(constraint.ref);
  if (!segment) return;
  const target = access.point(constraint.target);
  out.push(
    target[0] - (segment[0][0] + segment[1][0]) / 2,
    target[1] - (segment[0][1] + segment[1][1]) / 2,
  );
}

/** Resolves the midpoint constraint residual. */
export function appendMidpointResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendMidpoint(out, constraint, access);
}
