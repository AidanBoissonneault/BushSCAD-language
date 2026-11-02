/**
 * @author Aidan Boissonneault
 * @file constraint-values.ts
 * @purpose Provides constraint values behavior for the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import type {
  SolverDimension,
  SolverScalarExpression,
} from '../types/types.js';
import { distance, segmentAngle, wrapAngle } from './constraint-geometry.js';
import type { ConstraintAccess } from './constraint-access.js';

/** Evaluates a driving scalar expression against live sketch measurements. */
export function evaluateSolverScalar(
  expression: number | SolverScalarExpression,
  dimensions: Map<string, SolverDimension>,
  access: ConstraintAccess,
): number {
  if (typeof expression === 'number') return expression;
  if (expression.kind === 'constant') return expression.value;
  if (expression.kind === 'dimension') {
    const dimension = dimensions.get(expression.name);
    return dimension ? measureSolverDimension(dimension, access) : Number.NaN;
  }
  if (expression.kind === 'negate') {
    return -evaluateSolverScalar(expression.operand, dimensions, access);
  }
  const left = evaluateSolverScalar(expression.left, dimensions, access);
  const right = evaluateSolverScalar(expression.right, dimensions, access);
  if (expression.op === '+') return left + right;
  if (expression.op === '-') return left - right;
  if (expression.op === '*') return left * right;
  if (expression.op === '/') return right === 0 ? Number.NaN : left / right;
  return right === 0 ? Number.NaN : left % right;
}

/** Measures one named length, distance, angle, radius, or diameter. */
export function measureSolverDimension(
  dimension: SolverDimension,
  access: ConstraintAccess,
): number {
  if (dimension.dimension === 'length') {
    const segment = access.segment(dimension.target);
    return segment ? distance(...segment) : Number.NaN;
  }
  if (dimension.dimension === 'distance') {
    return measureDistance(
      dimension.target,
      dimension.ref,
      dimension.axis,
      access,
    );
  }
  if (dimension.dimension === 'angle') {
    return measureAngle(dimension.target, dimension.ref, access);
  }
  const radius = access.radius(dimension.target);
  if (radius === undefined) return Number.NaN;
  return dimension.dimension === 'diameter' ? radius * 2 : radius;
}

/**
 * Handles measure distance in the constraints flow.
 */
function measureDistance(
  target: string,
  ref: string | undefined,
  axis: SolverDimension['axis'],
  access: ConstraintAccess,
): number {
  if (!ref) return Number.NaN;
  const point = access.point(target);
  if (ref === 'origin') return distance(point, [0, 0]);
  if (ref === 'origin.x_axis') return Math.abs(point[1]);
  if (ref === 'origin.y_axis') return Math.abs(point[0]);
  const reference = access.point(ref);
  if (axis === 'x') return Math.abs(point[0] - reference[0]);
  if (axis === 'y') return Math.abs(point[1] - reference[1]);
  return distance(point, reference);
}

/**
 * Handles measure angle in the constraints flow.
 */
function measureAngle(
  target: string,
  ref: string | undefined,
  access: ConstraintAccess,
): number {
  const segment = access.segment(target);
  if (!segment) return Number.NaN;
  const targetAngle = segmentAngle(segment);
  const referenceAngle = axisAngle(ref) ?? segmentReferenceAngle(ref, access);
  const relative = Math.abs(wrapAngle(targetAngle - referenceAngle));
  return (Math.min(relative, Math.PI * 2 - relative) * 180) / Math.PI;
}

/**
 * Builds the axis data required by the current operation.
 */
function axisAngle(ref: string | undefined): number | null {
  if (!ref || ref === 'origin.x_axis') return 0;
  if (ref === 'origin.y_axis') return Math.PI / 2;
  return null;
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentReferenceAngle(
  ref: string | undefined,
  access: ConstraintAccess,
): number {
  const segment = ref ? access.segment(ref) : null;
  return segment ? segmentAngle(segment) : Number.NaN;
}
