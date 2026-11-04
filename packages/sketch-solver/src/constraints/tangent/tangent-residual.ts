import { cross, vector } from '../constraint-geometry.js';
import type { SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends tangent to the current output.
 */
function appendTangent(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
): void {
  if (!constraint.ref) return;
  const targetRadius = access.radius(constraint.target);
  const arcName =
    targetRadius === undefined ? constraint.ref : constraint.target;
  const lineName =
    targetRadius === undefined ? constraint.target : constraint.ref;
  const line = access.segment(lineName);
  const arc = access.arc(arcName);
  if (!line || !arc) return;
  const direction = vector(line);
  const length = Math.hypot(...direction);
  if (length < 1e-12) return;
  out.push(
    Math.abs(
      cross(
        [arc.center[0] - line[0][0], arc.center[1] - line[0][1]],
        direction,
      ),
    ) /
      length -
      Math.abs(arc.radius),
  );
}

/** Resolves the tangent constraint residual. */
export function appendTangentResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendTangent(out, constraint, access);
}
