/**
 * @author Aidan Boissonneault
 * @file vector.ts
 * @purpose Provides 3D vector operations used by model analysis.
 * @last-edited October 6, 2026
 */

/**
 * vec3 represented by [number, number, number].
 */

export type Vec3 = [number, number, number];

/**
 * Adds to its owning collection.
 */
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Handles subtract in the types flow.
 */
export function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Returns the cross product of the supplied vectors.
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

/**
 * Returns the dot product of the supplied vectors.
 */
export function dot(a: Vec3, b: Vec3): number {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

/**
 * Handles length in the types flow.
 */
export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Handles scale in the types flow.
 */
export function scale(a: Vec3, value: number): Vec3 {
  return [a[0] * value, a[1] * value, a[2] * value];
}
