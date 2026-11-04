import type { SolverConstraint, SolverDimension } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import { constraintValue } from '../residual/residual-geometry.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends radial to the current output.
 */
function appendRadial(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
  scale: 1 | 2,
): void {
  const radius = access.radius(constraint.target);
  const value = constraintValue(constraint, access, dimensions);
  if (radius !== undefined && value !== undefined)
    out.push(radius * scale - value);
}

/** Resolves radius and diameter constraints using their respective scales. */
export function appendRadialResidual(
  context: ResidualContext,
  scale: 1 | 2,
): void {
  appendRadial(
    context.out,
    context.constraint,
    context.access,
    context.dimensions,
    scale,
  );
}
