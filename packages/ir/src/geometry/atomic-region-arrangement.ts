/**
 * @author Aidan Boissonneault
 * @file atomic-region-arrangement.ts
 * @purpose Provides atomic region arrangement behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { IRProfileLoop } from './profileRegions.js';
import { intersectEllipseSegment } from './conicIntersections.js';

const EPS = 1e-7;

/**
 * Atomic arrangement coordinates, including xs, ys, and point geometry.
 */
export type AtomicArrangementCoordinates = {
  xs: number[];
  ys: number[];
  points: [number, number][];
};

/** Builds deterministic sampling axes using exact conic crossing coordinates. */
export function atomicArrangementCoordinates(
  loops: IRProfileLoop[],
): AtomicArrangementCoordinates {
  const xs: number[] = [];
  const ys: number[] = [];
  const points: [number, number][] = [];
  for (const loop of loops) {
    for (const point of loop.samplePoints) {
      xs.push(point[0]);
      ys.push(point[1]);
    }
    points.push(interiorPoint(loop.samplePoints));
  }
  addIntersections(loops, xs, ys, points);
  return { xs: sortedUnique(xs), ys: sortedUnique(ys), points };
}

/**
 * Adds intersections to its owning collection.
 */
function addIntersections(
  loops: IRProfileLoop[],
  xs: number[],
  ys: number[],
  points: [number, number][],
): void {
  for (let first = 0; first < loops.length; first += 1) {
    for (let second = first + 1; second < loops.length; second += 1) {
      const exact = exactConicIntersections(loops[first], loops[second]);
      const hits = exact ?? sampledIntersections(loops[first], loops[second]);
      hits.forEach((point) => appendIntersection(point, xs, ys, points));
    }
  }
}

/**
 * Handles exact conic intersections in the geometry flow.
 */
function exactConicIntersections(
  first: IRProfileLoop,
  second: IRProfileLoop,
): [number, number][] | null {
  if (
    !first.segments.some((segment) => segment.kind === 'ellipse') &&
    !second.segments.some((segment) => segment.kind === 'ellipse')
  ) {
    return null;
  }
  const points: [number, number][] = [];
  for (const a of first.segments) {
    for (const b of second.segments) {
      const ellipse =
        a.kind === 'ellipse' ? a : b.kind === 'ellipse' ? b : null;
      if (!ellipse) continue;
      const other = ellipse === a ? b : a;
      const result = intersectEllipseSegment(ellipse, other);
      if (result.relation === 'discrete') {
        points.push(...result.intersections.map((hit) => hit.point));
      }
    }
  }
  return uniquePoints(points);
}

/**
 * Handles sampled intersections in the geometry flow.
 */
function sampledIntersections(
  first: IRProfileLoop,
  second: IRProfileLoop,
): [number, number][] {
  const points: [number, number][] = [];
  for (const edgeA of polygonEdges(first.samplePoints)) {
    for (const edgeB of polygonEdges(second.samplePoints)) {
      const point = segmentIntersection(edgeA[0], edgeA[1], edgeB[0], edgeB[1]);
      if (point) points.push(point);
    }
  }
  return uniquePoints(points);
}

/**
 * Appends intersection to the current output.
 */
function appendIntersection(
  point: [number, number],
  xs: number[],
  ys: number[],
  points: [number, number][],
): void {
  xs.push(point[0]);
  ys.push(point[1]);
  points.push(
    [point[0] - EPS * 10, point[1] - EPS * 10],
    [point[0] + EPS * 10, point[1] - EPS * 10],
    [point[0] - EPS * 10, point[1] + EPS * 10],
    [point[0] + EPS * 10, point[1] + EPS * 10],
  );
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentIntersection(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): [number, number] | null {
  const point = lineIntersection(a, b, c, d);
  return pointOnSegment(point, a, b) && pointOnSegment(point, c, d)
    ? point
    : null;
}

/** Returns the infinite-line crossing used by polygon clipping and sampling. */
export function lineIntersection(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): [number, number] {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const dcx = d[0] - c[0];
  const dcy = d[1] - c[1];
  const denominator = bax * dcy - bay * dcx;
  if (Math.abs(denominator) <= EPS) return b;
  const t = ((c[0] - a[0]) * dcy - (c[1] - a[1]) * dcx) / denominator;
  return [a[0] + bax * t, a[1] + bay * t];
}

/**
 * Handles polygon edges in the geometry flow.
 */
export function polygonEdges(
  points: [number, number][],
): [[number, number], [number, number]][] {
  return points.map((point, index) => [
    point,
    points[(index + 1) % points.length],
  ]);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointOnSegment(
  point: [number, number],
  a: [number, number],
  b: [number, number],
): boolean {
  return (
    point[0] >= Math.min(a[0], b[0]) - EPS &&
    point[0] <= Math.max(a[0], b[0]) + EPS &&
    point[1] >= Math.min(a[1], b[1]) - EPS &&
    point[1] <= Math.max(a[1], b[1]) + EPS
  );
}

/**
 * Handles sorted unique in the geometry flow.
 */
function sortedUnique(values: number[]): number[] {
  return [
    ...new Set(values.map((value) => Math.round(value / EPS) * EPS)),
  ].sort((a, b) => a - b);
}

/**
 * Removes duplicate points values while preserving their first occurrence.
 */
function uniquePoints(points: [number, number][]): [number, number][] {
  return points.filter(
    (point, index) =>
      points.findIndex(
        (candidate) =>
          Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) <=
          EPS * 8,
      ) === index,
  );
}

/**
 * Handles interior point in the geometry flow.
 */
function interiorPoint(points: [number, number][]): [number, number] {
  return [
    points.reduce((sum, point) => sum + point[0], 0) /
      Math.max(1, points.length),
    points.reduce((sum, point) => sum + point[1], 0) /
      Math.max(1, points.length),
  ];
}
