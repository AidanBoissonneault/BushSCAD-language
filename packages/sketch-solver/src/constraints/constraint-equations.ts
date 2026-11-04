/**
 * @author Aidan Boissonneault
 * @file constraint-equations.ts
 * @purpose Dispatches constraints to feature-owned residual implementations.
 * @last-edited October 6, 2026
 */

import type {
  SolverDimension,
  SolverConstraint,
  SolverSegment,
} from '../types/types.js';
import type { ConstraintPoint as Point } from './constraint-geometry.js';
import { createConstraintAccess } from './constraint-access.js';
import type { ResidualContext } from './residual/context.js';
import { appendHorizontalResidual } from './horizontal/horizontal-residual.js';
import { appendVerticalResidual } from './vertical/vertical-residual.js';
import { appendCoincidentResidual } from './coincident/coincident-residual.js';
import { appendMidpointResidual } from './midpoint/midpoint-residual.js';
import { appendPairResidual } from './pair/pair-residual.js';
import { appendTangentResidual } from './tangent/tangent-residual.js';
import { appendSymmetricResidual } from './symmetric/symmetric-residual.js';
import { appendLengthResidual } from './length/length-residual.js';
import { appendDistanceResidual } from './distance/distance-residual.js';
import { appendAngleResidual } from './angle/angle-residual.js';
import { appendRadialResidual } from './radial/radial-residual.js';

const RESIDUAL_HANDLERS: Partial<
  Record<SolverConstraint['kind'], (context: ResidualContext) => void>
> = {
  horizontal: appendHorizontalResidual,
  vertical: appendVerticalResidual,
  fixed: () => undefined,
  coincident: appendCoincidentResidual,
  midpoint: appendMidpointResidual,
  parallel: appendPairResidual,
  perpendicular: appendPairResidual,
  equal: appendPairResidual,
  tangent: appendTangentResidual,
  symmetric: appendSymmetricResidual,
  length: appendLengthResidual,
  distance: appendDistanceResidual,
  angle: appendAngleResidual,
  radius: (context) => appendRadialResidual(context, 1),
  diameter: (context) => appendRadialResidual(context, 2),
};

function appendResidual(
  out: number[],
  constraint: SolverConstraint,
  access: ReturnType<typeof createConstraintAccess>,
  dimensions: Map<string, SolverDimension>,
): void {
  const context: ResidualContext = {
    out,
    constraint,
    target: access.segment(constraint.target),
    access,
    dimensions,
  };
  RESIDUAL_HANDLERS[constraint.kind]?.(context);
}

/**
 * Builds the residual vector for the current sketch coordinates.
 *
 * Constraint semantics change independently from Newton iteration. Keeping
 * equations here makes relationships such as relative angles explicit while
 * leaving the solver focused on convergence.
 */
export function buildConstraintEquations(
  constraints: SolverConstraint[],
  segments: Map<string, SolverSegment>,
  vars: number[],
  varIndex: Map<string, number>,
  fixedPoints: Map<string, Point>,
  dimensions: SolverDimension[] = [],
): number[] {
  const residuals: number[] = [];
  const access = createConstraintAccess(segments, vars, varIndex, fixedPoints);
  const dimensionMap = new Map(dimensions.map((item) => [item.name, item]));
  for (const constraint of constraints) {
    appendResidual(residuals, constraint, access, dimensionMap);
  }
  return residuals;
}
