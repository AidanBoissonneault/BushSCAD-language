import {
  cross,
  vector,
  type ConstraintPoint as Point,
} from '../constraint-geometry.js';
import type { SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends symmetric to the current output.
 */
function appendSymmetric(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
): void {
  if (!constraint.ref) return;
  const target = access.segment(constraint.target);
  if (!target) return;
  const midpoint: Point = [
    (target[0][0] + target[1][0]) / 2,
    (target[0][1] + target[1][1]) / 2,
  ];
  const axis = access.segment(constraint.ref);
  if (!axis) {
    const point = access.point(constraint.ref);
    out.push(midpoint[0] - point[0], midpoint[1] - point[1]);
    return;
  }
  out.push(
    cross([midpoint[0] - axis[0][0], midpoint[1] - axis[0][1]], vector(axis)),
  );
}

/** Resolves the symmetric constraint residual. */
export function appendSymmetricResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendSymmetric(out, constraint, access);
}
