/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for sketch solver package.
 * @last-edited October 6, 2026
 */

export { solve } from './core/solver.js';
export type {
  SolveInput,
  SolveResult,
  SolveResultOk,
  SolveResultUnderconstrained,
  SolveResultOverconstrained,
  SolveResultNoConvergence,
  SolverPoint,
  SolverSegment,
  SolverLineSegment,
  SolverArcSegment,
  SolverConstraint,
  ConstraintKind,
  SegmentEndpointRef,
  SolverDimension,
  SolverDimensionKind,
  SolverScalarExpression,
} from './types/types.js';
