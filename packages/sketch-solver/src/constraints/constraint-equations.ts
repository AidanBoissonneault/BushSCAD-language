/**
 * @author Aidan Boissonneault
 * @file constraint-equations.ts
 * @purpose Provides constraint equations behavior for the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import { axisDistanceResidual } from './axis-distance.js';
import { appendAxisAlignment } from './axis-alignment.js';
import {
  cross,
  distance,
  dot,
  segmentAngle,
  vector,
  wrapAngle,
  type ConstraintPoint as Point,
  type ConstraintSegmentPoints as SegmentPoints,
} from './constraint-geometry.js';
import type {
  SolverDimension,
  SolverConstraint,
  SolverSegment,
} from '../types/types.js';
import {
  createConstraintAccess,
  type ConstraintAccess,
} from './constraint-access.js';
import { evaluateSolverScalar } from './constraint-values.js';

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

/**
 * Appends residual to the current output.
 */
function appendResidual(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): void {
  const target = access.segment(constraint.target);
  RESIDUAL_HANDLERS[constraint.kind]?.({
    out,
    constraint,
    target,
    access,
    dimensions,
  });
}

/**
 * Context for residual, including out, constraint, target, access, and dimensions.
 */
type ResidualContext = {
  out: number[];
  constraint: SolverConstraint;
  target: SegmentPoints | null;
  access: ConstraintAccess;
  dimensions: Map<string, SolverDimension>;
};

const RESIDUAL_HANDLERS: Partial<
  Record<SolverConstraint['kind'], (context: ResidualContext) => void>
> = {
  horizontal: ({ out, constraint, target, access }) =>
    appendAxisAlignment(out, constraint, target, access, 1),
  vertical: ({ out, constraint, target, access }) =>
    appendAxisAlignment(out, constraint, target, access, 0),
  fixed: () => undefined,
  coincident: ({ out, constraint, access }) =>
    appendCoincident(out, constraint, access),
  midpoint: ({ out, constraint, access }) =>
    appendMidpoint(out, constraint, access),
  parallel: appendPairResidual,
  perpendicular: appendPairResidual,
  equal: appendPairResidual,
  tangent: ({ out, constraint, access }) =>
    appendTangent(out, constraint, access),
  symmetric: ({ out, constraint, access }) =>
    appendSymmetric(out, constraint, access),
  length: ({ out, constraint, target, access, dimensions }) => {
    const value = constraintValue(constraint, access, dimensions);
    if (target && value !== undefined) {
      out.push(distance(...target) - value);
    }
  },
  distance: ({ out, constraint, access, dimensions }) =>
    appendDistance(out, constraint, access, dimensions),
  angle: ({ out, constraint, target, access, dimensions }) =>
    appendAngle(out, constraint, target, access, dimensions),
  radius: ({ out, constraint, access, dimensions }) =>
    appendRadial(out, constraint, access, dimensions, 1),
  diameter: ({ out, constraint, access, dimensions }) =>
    appendRadial(out, constraint, access, dimensions, 2),
};

/**
 * Appends pair residual to the current output.
 */
function appendPairResidual({
  out,
  constraint,
  access,
}: ResidualContext): void {
  appendPair(out, constraint, access);
}

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

/**
 * Appends distance to the current output.
 */
function appendDistance(
  out: number[],
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): void {
  const value = constraintValue(constraint, access, dimensions);
  if (value === undefined || !constraint.ref) return;
  const target = access.point(constraint.target);
  const reference = access.point(constraint.ref);
  const axis = axisDistanceResidual(constraint, target, value, reference);
  out.push(axis ?? distance(target, reference) - value);
}

/**
 * Appends angle to the current output.
 */
function appendAngle(
  out: number[],
  constraint: SolverConstraint,
  target: SegmentPoints | null,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): void {
  const value = constraintValue(constraint, access, dimensions);
  if (!target || value === undefined) return;
  const desired = (value * Math.PI) / 180;
  const targetAngle = segmentAngle(target);
  if (!constraint.ref) {
    out.push(wrapAngle(targetAngle - desired));
    return;
  }
  const referenceAngle = axisReferenceAngle(constraint.ref);
  const reference = access.segment(constraint.ref);
  if (referenceAngle !== null || reference) {
    out.push(
      Math.abs(
        wrapAngle(
          targetAngle -
            (referenceAngle ?? segmentAngle(reference as SegmentPoints)),
        ),
      ) - desired,
    );
  }
}

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

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentPair(
  constraint: SolverConstraint,
  access: ConstraintAccess,
): [SegmentPoints, SegmentPoints] | null {
  if (!constraint.ref) return null;
  const target = access.segment(constraint.target);
  const reference = access.segment(constraint.ref);
  return target && reference ? [target, reference] : null;
}

/**
 * Handles constraint value in the constraints flow.
 */
function constraintValue(
  constraint: SolverConstraint,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): number | undefined {
  return constraint.value === undefined
    ? undefined
    : evaluateSolverScalar(constraint.value, dimensions, access);
}

/**
 * Builds the axis data required by the current operation.
 */
function axisReferenceAngle(ref: string): number | null {
  if (ref === 'origin.x_axis') return 0;
  if (ref === 'origin.y_axis') return Math.PI / 2;
  return null;
}
