/**
 * @author Aidan Boissonneault
 * @file profileContainment.ts
 * @purpose Provides profile containment behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { IRArcSegment, IRProfileSegment } from '../sketch/sketchIr.js';
import {
  ellipseRayCrossings,
  pointOnEllipseSegment,
} from './ellipseGeometry.js';

const EPS = 1e-7;
const TAU = Math.PI * 2;

/**
 * Tests whether a point lies inside or on a closed profile loop.
 * Closed-body declarations must use the exact line and arc geometry. A sampled
 * polygon can misclassify points close to curved edges and select another body.
 */
export function pointInProfileSegments(
  point: readonly [number, number],
  segments: readonly IRProfileSegment[],
): boolean {
  return pointInDrawableSegments(point, segments, true);
}

/**
 * Tests whether a point is strictly inside a closed profile loop.
 * Closed-body point declarations should not accidentally select an adjacent
 * region when the generated point falls on a shared edge or sampled boundary.
 */
export function pointStrictlyInProfileSegments(
  point: readonly [number, number],
  segments: readonly IRProfileSegment[],
): boolean {
  return pointInDrawableSegments(point, segments, false);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointInDrawableSegments(
  point: readonly [number, number],
  segments: readonly IRProfileSegment[],
  includeBoundary: boolean,
): boolean {
  const drawable = segments.filter((segment) => !segment.construction);
  const onBoundary = drawable.some((segment) =>
    pointOnProfileSegment(point, segment),
  );
  if (onBoundary) return includeBoundary;

  return pointHasOddRayCrossings(point, drawable);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointHasOddRayCrossings(
  point: readonly [number, number],
  segments: readonly IRProfileSegment[],
): boolean {
  let crossings = 0;
  for (const segment of segments) {
    if (segment.kind === 'line') {
      crossings += lineRayCrossings(point, segment.from, segment.to);
    } else if (segment.kind === 'arc') {
      crossings += arcRayCrossings(point, segment);
    } else {
      crossings += ellipseRayCrossings(point, segment);
    }
  }
  return crossings % 2 === 1;
}

/** Returns the center implied by a radius arc's endpoints and direction. */
export function profileArcCenter(segment: IRArcSegment): [number, number] {
  const [fromX, fromY] = segment.from;
  const [toX, toY] = segment.to;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const chord = Math.hypot(dx, dy);
  if (chord <= EPS) return [fromX, fromY];

  const height = Math.sqrt(Math.max(0, segment.radius ** 2 - (chord / 2) ** 2));
  const sign = segment.clockwise ? -1 : 1;
  return [
    (fromX + toX) / 2 + (-dy / chord) * height * sign,
    (fromY + toY) / 2 + (dx / chord) * height * sign,
  ];
}

/** Tests exact line/conic membership with an optional modeling tolerance. */
export function pointOnProfileSegment(
  point: readonly [number, number],
  segment: IRProfileSegment,
  tolerance = EPS,
): boolean {
  if (segment.kind === 'line') {
    return pointOnLineSegment(point, segment.from, segment.to, tolerance);
  }
  return segment.kind === 'arc'
    ? pointOnArc(point, segment, tolerance)
    : pointOnEllipseSegment(point, segment, tolerance);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointOnLineSegment(
  point: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
  tolerance = EPS,
): boolean {
  const [pointX, pointY] = point;
  const [fromX, fromY] = from;
  const delta: [number, number] = [to[0] - fromX, to[1] - fromY];
  const cross = (pointX - fromX) * delta[1] - (pointY - fromY) * delta[0];
  const scale = Math.max(1, Math.hypot(...delta));
  if (Math.abs(cross) > tolerance * scale) return false;
  return (
    pointX >= Math.min(fromX, to[0]) - tolerance &&
    pointX <= Math.max(fromX, to[0]) + tolerance &&
    pointY >= Math.min(fromY, to[1]) - tolerance &&
    pointY <= Math.max(fromY, to[1]) + tolerance
  );
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointOnArc(
  point: readonly [number, number],
  segment: IRArcSegment,
  tolerance = EPS,
): boolean {
  const center = profileArcCenter(segment);
  const distance = Math.hypot(point[0] - center[0], point[1] - center[1]);
  if (
    Math.abs(distance - segment.radius) >
    tolerance * Math.max(1, segment.radius)
  )
    return false;
  const angle = Math.atan2(point[1] - center[1], point[0] - center[0]);
  return arcParameter(segment, center, angle, false, tolerance) !== null;
}

/**
 * Creates line geometry from the supplied endpoints.
 */
function lineRayCrossings(
  point: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  if (from[1] > point[1] === to[1] > point[1]) return 0;
  const x =
    from[0] + ((point[1] - from[1]) * (to[0] - from[0])) / (to[1] - from[1]);
  return x > point[0] ? 1 : 0;
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcRayCrossings(
  point: readonly [number, number],
  segment: IRArcSegment,
): number {
  const center = profileArcCenter(segment);
  const relativeY = point[1] - center[1];
  if (Math.abs(relativeY) >= segment.radius) return 0;
  const angle = Math.asin(relativeY / segment.radius);
  const candidates = [angle, Math.PI - angle];
  return candidates.reduce((count, candidate) => {
    const x = center[0] + Math.cos(candidate) * segment.radius;
    if (
      x <= point[0] ||
      arcParameter(segment, center, candidate, true) === null
    )
      return count;
    return count + 1;
  }, 0);
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcParameter(
  segment: IRArcSegment,
  center: readonly [number, number],
  angle: number,
  excludeEnd = false,
  tolerance = EPS,
): number | null {
  const start = Math.atan2(
    segment.from[1] - center[1],
    segment.from[0] - center[0],
  );
  const end = Math.atan2(segment.to[1] - center[1], segment.to[0] - center[0]);
  const sweep = directedAngle(end - start, segment.clockwise);
  const offset = directedAngle(angle - start, segment.clockwise);
  const parameter = offset / sweep;
  if (parameter < -tolerance || parameter > 1 + tolerance) return null;
  if (excludeEnd && parameter >= 1 - tolerance) return null;
  return parameter;
}

/**
 * Handles directed angle in the geometry flow.
 */
function directedAngle(angle: number, clockwise: boolean): number {
  let normalized = ((angle % TAU) + TAU) % TAU;
  if (normalized <= EPS || TAU - normalized <= EPS) normalized = 0;
  return clockwise && normalized !== 0 ? normalized - TAU : normalized;
}
