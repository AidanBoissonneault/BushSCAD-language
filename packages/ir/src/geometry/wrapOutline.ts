/**
 * @author Aidan Boissonneault
 * @file wrapOutline.ts
 * @purpose Provides wrap outline behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { WrapMode } from '../ast/sketchPrimitives.js';
import type { WrapPoint } from './wrapTypes.js';

/**
 * Resolves the ordered control points used by a wrap mode.
 * Convex wraps replace authored order with a hull while every other mode keeps
 * authored point order before generated edge/rounding behavior is applied.
 */
export function wrapOutlinePoints(
  points: WrapPoint[],
  mode: WrapMode,
): WrapPoint[] {
  if (mode === 'convex') return convexHull(points);
  return points;
}

/**
 * Handles convex hull in the geometry flow.
 */
function convexHull(points: WrapPoint[]): WrapPoint[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: WrapPoint[] = [];
  for (const point of sorted) pushHullPoint(lower, point);
  const upper: WrapPoint[] = [];
  for (const point of [...sorted].reverse()) pushHullPoint(upper, point);
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Handles push hull point in the geometry flow.
 */
function pushHullPoint(hull: WrapPoint[], point: WrapPoint): void {
  while (
    hull.length >= 2 &&
    cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0
  ) {
    hull.pop();
  }
  hull.push(point);
}

/**
 * Returns the cross product of the supplied vectors.
 */
function cross(a: WrapPoint, b: WrapPoint, c: WrapPoint): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
