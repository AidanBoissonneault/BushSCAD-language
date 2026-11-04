/** Resolves the length constraint against a segment's measured distance. */
import { distance } from '../constraint-geometry.js';
import { constraintValue } from '../residual/residual-geometry.js';
import type { ResidualContext } from '../residual/context.js';

export function appendLengthResidual({
  out,
  constraint,
  target,
  access,
  dimensions,
}: ResidualContext): void {
  const value = constraintValue(constraint, access, dimensions);
  if (target && value !== undefined) out.push(distance(...target) - value);
}
