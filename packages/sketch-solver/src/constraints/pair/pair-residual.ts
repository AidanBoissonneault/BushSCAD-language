import { cross, dot, vector } from '../constraint-geometry.js';
import type { SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ResidualContext } from '../residual/context.js';
import { segmentPair } from '../residual/residual-geometry.js';

/**
 * Appends pair to the current output.
 */
function appendPair(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
): void {
  const pair = segmentPair(constraint, access);
  if (!pair) return;
  const first = vector(pair[0]);
  const second = vector(pair[1]);
  if (constraint.kind === 'parallel') out.push(cross(first, second));
  if (constraint.kind === 'perpendicular') out.push(dot(first, second));
  if (constraint.kind === 'equal')
    out.push(dot(first, first) - dot(second, second));
}

/** Resolves parallel, perpendicular, and equal segment constraints. */
export function appendPairResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendPair(out, constraint, access);
}
