import type { SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends coincident to the current output.
 */
function appendCoincident(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
): void {
  if (!constraint.ref) return;
  const target = access.point(constraint.target);
  const reference = access.point(constraint.ref);
  out.push(target[0] - reference[0], target[1] - reference[1]);
}

/** Resolves the coincident constraint residual. */
export function appendCoincidentResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendCoincident(out, constraint, access);
}
