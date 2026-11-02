/**
 * @author Aidan Boissonneault
 * @file profile-utils.ts
 * @purpose Provides profile utils behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

/**
 * Creates an arc from its center, radius, and angular limits.
 */
export function arcPoint(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a), 0];
}

/**
 * Handles points differ in the profiles flow.
 */
export function pointsDiffer(
  a: [number, number, number],
  b: [number, number, number],
  tol = 1e-9,
): boolean {
  return (
    Math.abs(a[0] - b[0]) > tol ||
    Math.abs(a[1] - b[1]) > tol ||
    Math.abs(a[2] - b[2]) > tol
  );
}
