/**
 * @author Aidan Boissonneault
 * @file vector-math.ts
 * @purpose Provides vector math behavior for the core in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { Vec3 } from './geometry-utils.js';
import { dotVec } from '../topology/frame-utils.js';

/**
 * Handles subtract vec in the core flow.
 */
export function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Calculates the distance between the supplied points.
 */
export function distanceFromLine(point: Vec3, origin: Vec3, dir: Vec3): number {
  const delta = subtractVec(point, origin);
  const projected = dotVec(delta, dir);
  return Math.sqrt(Math.max(0, dotVec(delta, delta) - projected * projected));
}

/**
 * Handles projection range in the core flow.
 */
export function projectionRange(
  a: Vec3,
  b: Vec3,
  origin: Vec3,
  dir: Vec3,
): [number, number] {
  const aProjection = dotVec(subtractVec(a, origin), dir);
  const bProjection = dotVec(subtractVec(b, origin), dir);
  return [
    Math.min(aProjection, bProjection),
    Math.max(aProjection, bProjection),
  ];
}

/**
 * Handles ranges overlap in the core flow.
 */
export function rangesOverlap(
  a: [number, number],
  b: [number, number],
  tolerance: number,
): boolean {
  return b[1] >= a[0] - tolerance && b[0] <= a[1] + tolerance;
}
