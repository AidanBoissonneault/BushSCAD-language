/**
 * @author Aidan Boissonneault
 * @file wrapProfileSegments.ts
 * @purpose Provides wrap profile segments behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { WrapMode } from '../ast/sketchPrimitives.js';
import type { IRProfileSegment } from '../sketch/sketchIr.js';
import type { EvaluatedWrapOptions, WrapPoint } from './wrapTypes.js';
import { closedWrapLineSegments } from './wrapLineSegments.js';
import { roundedWrapSegments } from './wrapRoundedCorners.js';
import { pointDistance } from './wrapTypes.js';

const DEFAULT_SMOOTH_TENSION = 0.25;

/**
 * Generates profile segments from concrete wrap outline points.
 * The evaluator and visual sketch editor must preview the same generated wrap
 * boundary for ordered, convex, concave, smooth, and rounded modes.
 */
export function wrapProfileSegments(
  points: WrapPoint[],
  mode: WrapMode,
  options: EvaluatedWrapOptions,
): IRProfileSegment[] {
  if (mode === 'smooth') return smoothSegments(points, options);
  if (options.rounded)
    return roundedWrapSegments(points, options.rounded, mode);
  return closedWrapLineSegments(points, mode);
}

/**
 * Handles smooth segments in the geometry flow.
 */
function smoothSegments(
  points: WrapPoint[],
  options: EvaluatedWrapOptions,
): IRProfileSegment[] {
  const radius = options.rounded ?? autoSmoothRadius(points, options.tension);
  return roundedWrapSegments(points, radius, 'smooth');
}

/**
 * Handles auto smooth radius in the geometry flow.
 */
function autoSmoothRadius(
  points: WrapPoint[],
  tension: number | undefined,
): number {
  const ratio = tension ?? DEFAULT_SMOOTH_TENSION;
  const shortest = points.reduce((min, point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.min(min, pointDistance(point, next));
  }, Number.POSITIVE_INFINITY);
  return Number.isFinite(shortest) ? shortest * ratio : 0;
}
