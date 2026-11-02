/**
 * @author Aidan Boissonneault
 * @file profileRegions.ts
 * @purpose Provides profile regions behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRArcSegment,
  IRClosedBody,
  IRProfileSegment,
} from '../sketch/sketchIr.js';
import {
  pointInProfileSegments,
  profileArcCenter,
} from './profileContainment.js';
import { sampleArcAroundCenter2d } from './arcSampling.js';
import { analyzeCircularArcLoop } from './circularArcLoop.js';
import { sampleEllipseSegment } from './ellipseGeometry.js';

const EPS = 1e-7;
const ARC_STEPS = 24;

/**
 * Ir profile loop, including identifier, segments, segment names, sample points, and area.
 */
export type IRProfileLoop = {
  id: string;
  segments: IRProfileSegment[];
  segmentNames: string[];
  samplePoints: [number, number][];
  area: number;
};

/**
 * Splits a solved profile into sequential closed loops.
 * Path sketches may contain more than one closed body. The evaluator and OCCT
 * bridge both need stable loop membership without reinterpreting source syntax.
 */
export function detectProfileLoops(
  segments: IRProfileSegment[],
): IRProfileLoop[] {
  const loops: IRProfileLoop[] = [];
  let current: IRProfileSegment[] = [];
  for (const segment of segments.filter((item) => !item.construction)) {
    if (
      current.length > 0 &&
      !pointsEqual(current[current.length - 1].to, segment.from)
    ) {
      current = [];
    }
    current.push(segment);
    if (pointsEqual(current[0].from, segment.to)) {
      loops.push(loopFromSegments(current, loops.length));
      current = [];
    }
  }
  return loops;
}

/** Returns true when every solid profile segment is part of a closed loop. */
export function profileSegmentsAreClosed(
  segments: IRProfileSegment[],
): boolean {
  const solidSegments = segments.filter((item) => !item.construction);
  const solidCount = solidSegments.length;
  if (solidCount === 0) return true;
  if (
    solidSegments.every((segment) => segment.kind === 'arc') &&
    analyzeCircularArcLoop(solidSegments, EPS).recognized
  ) {
    return true;
  }
  return (
    detectProfileLoops(segments).reduce(
      (sum, loop) => sum + loop.segments.length,
      0,
    ) === solidCount
  );
}

/**
 * Selects the smallest closed loop containing a point.
 * Nested regions should bind to the most specific body, matching common CAD
 * selection behavior when users click inside overlapping closed regions.
 */
export function selectLoopContainingPoint(
  loops: IRProfileLoop[],
  point: [number, number],
): IRProfileLoop | null {
  return (
    loops
      .filter((loop) => pointInProfileSegments(point, loop.segments))
      .sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0] ?? null
  );
}

/** Returns the solid profile segments selected by closed-body metadata. */
export function selectedProfileSegments(
  segments: IRProfileSegment[],
  bodies: IRClosedBody[] | undefined,
  selectedNames?: string[],
): IRProfileSegment[] {
  if (!bodies || bodies.length === 0) return segments;
  const selected = selectedNames?.length
    ? bodies.filter((body) => selectedNames.includes(body.name ?? body.id))
    : bodies.filter((body) => !body.ignored);
  const names = new Set(selected.flatMap((body) => body.segmentNames));
  return segments.filter(
    (segment) => segment.construction || names.has(segment.name),
  );
}

/**
 * Handles loop from segments in the geometry flow.
 */
function loopFromSegments(
  segments: IRProfileSegment[],
  index: number,
): IRProfileLoop {
  const samplePoints = sampleLoop(segments);
  return {
    id: `body_${index + 1}`,
    segments: [...segments],
    segmentNames: segments.map((segment) => segment.name),
    samplePoints,
    area: signedArea2d(samplePoints),
  };
}

/**
 * Handles sample loop in the geometry flow.
 */
function sampleLoop(segments: IRProfileSegment[]): [number, number][] {
  const points: [number, number][] = [];
  for (const segment of segments) {
    const sampled =
      segment.kind === 'line'
        ? [segment.from, segment.to]
        : segment.kind === 'arc'
          ? sampleArc(segment)
          : sampleEllipseSegment(segment);
    for (const point of sampled) {
      if (
        points.length === 0 ||
        !pointsEqual(points[points.length - 1], point)
      ) {
        points.push(point);
      }
    }
  }
  if (points.length > 1 && pointsEqual(points[0], points[points.length - 1])) {
    points.pop();
  }
  return points;
}

/**
 * Handles sample arc in the geometry flow.
 */
function sampleArc(segment: IRArcSegment): [number, number][] {
  const center = profileArcCenter(segment);
  return sampleArcAroundCenter2d(
    center,
    segment.from,
    segment.to,
    segment.radius,
    segment.clockwise,
    ARC_STEPS,
  );
}

/** Tests whether a point lies inside a 2D polygon using even-odd winding. */
export function pointInPolygon2d(
  point: readonly [number, number],
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = a[1] > point[1] !== b[1] > point[1];
    if (
      crosses &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Calculates the signed area of a sampled 2D polygon.
 * Profile loop detection and overlap-region partitioning both need consistent
 * polygon orientation and area measurements.
 */
export function signedArea2d(points: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

/**
 * Handles points equal in the geometry flow.
 */
function pointsEqual(a: [number, number], b: [number, number]): boolean {
  return Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;
}
