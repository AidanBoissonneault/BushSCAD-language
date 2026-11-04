/** Shared inputs passed to one sketch constraint residual. */
import type { SolverDimension, SolverConstraint } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import type { ConstraintSegmentPoints } from '../constraint-geometry.js';

export type ResidualContext = {
  out: number[];
  constraint: SolverConstraint;
  target: ConstraintSegmentPoints | null;
  access: ConstraintAccess;
  dimensions: Map<string, SolverDimension>;
};
