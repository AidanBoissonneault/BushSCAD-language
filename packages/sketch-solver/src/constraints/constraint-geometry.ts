/**
 * @author Aidan Boissonneault
 * @file constraint-geometry.ts
 * @purpose Provides shared point, segment, and angle operations for sketch constraints.
 * @last-edited October 6, 2026
 */

/**
 * constraint point represented by [number, number].
 */

export type ConstraintPoint = [number, number];
/**
 * constraint segment points represented by [ConstraintPoint, ConstraintPoint].
 */
export type ConstraintSegmentPoints = [ConstraintPoint, ConstraintPoint];

/**
 * Handles vector in the constraints flow.
 */
export function vector(segment: ConstraintSegmentPoints): ConstraintPoint {
  return [segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]];
}

/**
 * Creates a segment from its endpoint coordinates.
 */
export function segmentAngle(segment: ConstraintSegmentPoints): number {
  const direction = vector(segment);
  return Math.atan2(direction[1], direction[0]);
}

/**
 * Wraps angle around the selected target.
 */
export function wrapAngle(value: number): number {
  let result = value;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

/**
 * Calculates the distance between the supplied points.
 */
export function distance(a: ConstraintPoint, b: ConstraintPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * Returns the dot product of the supplied vectors.
 */
export function dot(a: ConstraintPoint, b: ConstraintPoint): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Returns the cross product of the supplied vectors.
 */
export function cross(a: ConstraintPoint, b: ConstraintPoint): number {
  return a[0] * b[1] - a[1] * b[0];
}
