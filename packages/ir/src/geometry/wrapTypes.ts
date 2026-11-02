/**
 * @author Aidan Boissonneault
 * @file wrapTypes.ts
 * @purpose Provides point utilities and evaluated settings for wrap geometry.
 * @last-edited October 6, 2026
 */

/**
 * wrap point represented by [number, number].
 */

export type WrapPoint = [number, number];

/**
 * Options for evaluated wrap, including rounded, tension, and tolerance.
 */
export type EvaluatedWrapOptions = {
  rounded?: number;
  tension?: number;
  tolerance?: number;
};

export const GEOM_EPS = 1e-7;

/**
 * Creates point geometry from the supplied coordinates.
 */
export function pointDistance(a: WrapPoint, b: WrapPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Checks whether the supplied point values are equivalent.
 */
export function samePoint(a: WrapPoint, b: WrapPoint): boolean {
  return pointDistance(a, b) <= GEOM_EPS;
}

/**
 * Clamps to its supported range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Computes signed area for a closed wrap point loop.
 * Wrap rounding and generated-edge flexing both need consistent loop
 * orientation to decide which side of an edge is interior.
 */
export function signedArea(points: WrapPoint[]): number {
  return (
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2
  );
}
