/**
 * @author Aidan Boissonneault
 * @file axis-distance.ts
 * @purpose Provides axis distance behavior for the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import type { SolverConstraint } from '../types/types.js';

/**
 * pt represented by [number, number].
 */
type Pt = [number, number];

/**
 * Returns the residual for a distance-to-origin-axis constraint.
 * Axis dimensions are signed internally so solving preserves the side of the
 * X or Y axis while displaying a positive measured value.
 */
export function axisDistanceResidual(
  constraint: SolverConstraint,
  point: Pt,
  value: number,
  reference?: Pt,
): number | null {
  if (constraint.ref === 'origin.x_axis') {
    return point[1] - (constraint.axisSign ?? axisSign(point[1])) * value;
  }
  if (constraint.ref === 'origin.y_axis') {
    return point[0] - (constraint.axisSign ?? axisSign(point[0])) * value;
  }
  if (constraint.axis && reference) {
    const index = constraint.axis === 'x' ? 0 : 1;
    const delta = point[index] - reference[index];
    return delta - (constraint.axisSign ?? axisSign(delta)) * value;
  }
  return null;
}

/**
 * Builds the axis data required by the current operation.
 */
function axisSign(value: number): 1 | -1 {
  return value < 0 ? -1 : 1;
}
