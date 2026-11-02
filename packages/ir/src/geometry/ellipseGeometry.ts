/**
 * @author Aidan Boissonneault
 * @file ellipseGeometry.ts
 * @purpose Provides ellipse geometry behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { IREllipseSegment } from '../sketch/sketchIr.js';

export const ELLIPSE_TOLERANCE = 1e-7;
export const ELLIPSE_TAU = Math.PI * 2;

/** Returns the exact model-space point at an ellipse parameter. */
export function ellipsePoint(
  center: readonly [number, number],
  radiusX: number,
  radiusY: number,
  angle: number,
): [number, number] {
  return [
    center[0] + Math.cos(angle) * radiusX,
    center[1] + Math.sin(angle) * radiusY,
  ];
}

/** Returns the signed parameter sweep encoded by an ellipse segment. */
export function ellipseSweep(segment: IREllipseSegment): number {
  if (segment.full) return segment.clockwise ? -ELLIPSE_TAU : ELLIPSE_TAU;
  let sweep = normalizeAngle(segment.endAngle - segment.startAngle);
  if (segment.clockwise && sweep !== 0) sweep -= ELLIPSE_TAU;
  return sweep;
}

/** Maps an ellipse parameter to a segment-relative value, or rejects it. */
export function ellipseSegmentParameter(
  segment: IREllipseSegment,
  angle: number,
  excludeEnd = false,
  tolerance = ELLIPSE_TOLERANCE,
): number | null {
  if (segment.full) {
    const offset = directedOffset(
      angle - segment.startAngle,
      segment.clockwise,
    );
    return Math.abs(offset) <= tolerance ? 0 : offset / ellipseSweep(segment);
  }
  const sweep = ellipseSweep(segment);
  const offset = directedOffset(angle - segment.startAngle, segment.clockwise);
  const parameter = offset / sweep;
  if (parameter < -tolerance || parameter > 1 + tolerance) return null;
  if (excludeEnd && parameter >= 1 - tolerance) return null;
  return parameter;
}

/** Samples an exact ellipse segment for preview and non-topological area use. */
export function sampleEllipseSegment(
  segment: IREllipseSegment,
  steps = 64,
): [number, number][] {
  const sweep = ellipseSweep(segment);
  return Array.from({ length: steps + 1 }, (_, index) =>
    ellipsePoint(
      segment.center,
      segment.radiusX,
      segment.radiusY,
      segment.startAngle + sweep * (index / steps),
    ),
  );
}

/** Tests exact implicit-curve membership and the segment's parameter interval. */
export function pointOnEllipseSegment(
  point: readonly [number, number],
  segment: IREllipseSegment,
  tolerance = ELLIPSE_TOLERANCE,
): boolean {
  const nx = (point[0] - segment.center[0]) / segment.radiusX;
  const ny = (point[1] - segment.center[1]) / segment.radiusY;
  if (Math.abs(nx * nx + ny * ny - 1) > tolerance * 4) return false;
  return (
    ellipseSegmentParameter(segment, Math.atan2(ny, nx), false, tolerance) !==
    null
  );
}

/** Counts positive-X ray crossings against an exact ellipse interval. */
export function ellipseRayCrossings(
  point: readonly [number, number],
  segment: IREllipseSegment,
): number {
  const relativeY = (point[1] - segment.center[1]) / segment.radiusY;
  if (Math.abs(relativeY) >= 1) return 0;
  const angle = Math.asin(relativeY);
  return [angle, Math.PI - angle].reduce((count, candidate) => {
    const x = segment.center[0] + Math.cos(candidate) * segment.radiusX;
    return x > point[0] &&
      ellipseSegmentParameter(segment, candidate, true) !== null
      ? count + 1
      : count;
  }, 0);
}

/**
 * Handles directed offset in the geometry flow.
 */
function directedOffset(angle: number, clockwise: boolean): number {
  const normalized = normalizeAngle(angle);
  return clockwise && normalized !== 0 ? normalized - ELLIPSE_TAU : normalized;
}

/**
 * Normalizes angle into the canonical form.
 */
function normalizeAngle(angle: number): number {
  let normalized = ((angle % ELLIPSE_TAU) + ELLIPSE_TAU) % ELLIPSE_TAU;
  if (
    normalized <= ELLIPSE_TOLERANCE ||
    ELLIPSE_TAU - normalized <= ELLIPSE_TOLERANCE
  ) {
    normalized = 0;
  }
  return normalized;
}
