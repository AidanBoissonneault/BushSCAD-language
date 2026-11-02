/**
 * @author Aidan Boissonneault
 * @file atomicRegions.ts
 * @purpose Provides atomic regions behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { IRProfileLoop } from './profileRegions.js';
import { signedArea2d } from './profileRegions.js';
import {
  pointInProfileSegments,
  pointStrictlyInProfileSegments,
} from './profileContainment.js';
import {
  atomicArrangementCoordinates,
  lineIntersection,
  polygonEdges,
} from './atomic-region-arrangement.js';

const EPS = 1e-7;

/**
 * Ir atomic region, including identifier, include loop ids, excluded loop ids, sample point, and
 * sample points.
 */
export type IRAtomicRegion = {
  id: string;
  includeLoopIds: string[];
  excludedLoopIds: string[];
  samplePoint: [number, number];
  samplePoints: [number, number][];
  sampleCells: [number, number][][];
  area: number;
};

/**
 * Detects atomic filled regions implied by overlapping closed loops.
 * A sketch body is a selectable face region, not always a single source loop.
 * Overlapping loops create additional regions identified by the exact set of
 * loops that contain a point.
 */
export function detectAtomicRegions(loops: IRProfileLoop[]): IRAtomicRegion[] {
  if (loops.length === 0) return [];
  const keys = new Map<string, [number, number]>();
  for (const point of candidatePoints(loops)) {
    const membership = containingLoopIds(loops, point);
    if (membership.length > 0) keys.set(membership.join('\u0000'), point);
  }
  return [...keys.entries()]
    .map(([key, point]): IRAtomicRegion => {
      const includeLoopIds = key.split('\u0000');
      const excludedLoopIds = loops
        .map((loop) => loop.id)
        .filter((id) => !includeLoopIds.includes(id));
      const samplePoints = approximateRegionPolygon(loops, includeLoopIds);
      const sampleCells = sampleCellsForRegion(loops, includeLoopIds);
      return {
        id: 'body',
        includeLoopIds,
        excludedLoopIds,
        samplePoint: point,
        samplePoints,
        sampleCells,
        area: sampleCells.reduce(
          (sum, cell) => sum + Math.abs(signedArea2d(cell)),
          0,
        ),
      };
    })
    .sort(regionSort)
    .map((region, index) => ({ ...region, id: `body_${index + 1}` }));
}

/**
 * Builds explicit cell polygons for a region membership.
 * OCCT booleans over coplanar faces can return unstable results. These cells
 * give downstream face builders concrete planar regions for overlap bodies.
 */
export function sampleCellsForRegion(
  loops: IRProfileLoop[],
  includeLoopIds: string[],
): [number, number][][] {
  const { xs, ys } = atomicArrangementCoordinates(loops);
  const key = includeLoopIds.join('\u0000');
  const cells: [number, number][][] = [];
  for (let xi = 0; xi < xs.length - 1; xi++) {
    for (let yi = 0; yi < ys.length - 1; yi++) {
      const center: [number, number] = [
        (xs[xi] + xs[xi + 1]) / 2,
        (ys[yi] + ys[yi + 1]) / 2,
      ];
      if (containingLoopIds(loops, center).join('\u0000') !== key) continue;
      cells.push([
        [xs[xi], ys[yi]],
        [xs[xi + 1], ys[yi]],
        [xs[xi + 1], ys[yi + 1]],
        [xs[xi], ys[yi + 1]],
      ]);
    }
  }
  return cells;
}

/**
 * Selects the atomic region containing a point.
 * `closed(x, y)` and editor body hit-testing must resolve to the overlap
 * region when a point lies inside more than one loop.
 */
export function selectAtomicRegionContainingPoint(
  loops: IRProfileLoop[],
  regions: IRAtomicRegion[],
  point: [number, number],
): IRAtomicRegion | null {
  const strictKey = containingStrictLoopIds(loops, point).join('\u0000');
  const key = strictKey || containingLoopIds(loops, point).join('\u0000');
  if (!key) return null;
  return (
    regions.find((region) => region.includeLoopIds.join('\u0000') === key) ??
    null
  );
}

/** Returns the stable loop-membership ids for a point. */
export function containingLoopIds(
  loops: IRProfileLoop[],
  point: [number, number],
): string[] {
  return loops
    .filter((loop) => pointInProfileSegments(point, loop.segments))
    .map((loop) => loop.id)
    .sort();
}

/**
 * Handles containing strict loop ids in the geometry flow.
 */
function containingStrictLoopIds(
  loops: IRProfileLoop[],
  point: [number, number],
): string[] {
  return loops
    .filter((loop) => pointStrictlyInProfileSegments(point, loop.segments))
    .map((loop) => loop.id)
    .sort();
}

/**
 * Handles candidate points in the geometry flow.
 */
function candidatePoints(loops: IRProfileLoop[]): [number, number][] {
  const { xs, ys, points } = atomicArrangementCoordinates(loops);
  const sortedX = xs;
  const sortedY = ys;
  for (let xi = 0; xi < sortedX.length - 1; xi++) {
    for (let yi = 0; yi < sortedY.length - 1; yi++) {
      const x = (sortedX[xi] + sortedX[xi + 1]) / 2;
      const y = (sortedY[yi] + sortedY[yi + 1]) / 2;
      if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
    }
  }
  return points;
}

/**
 * Handles approximate region polygon in the geometry flow.
 */
function approximateRegionPolygon(
  loops: IRProfileLoop[],
  includeLoopIds: string[],
): [number, number][] {
  const included = includeLoopIds
    .map((id) => loops.find((loop) => loop.id === id))
    .filter((loop): loop is IRProfileLoop => Boolean(loop));
  if (included.length === 0) return [];
  return included
    .slice(1)
    .reduce(
      (polygon, loop) => clipPolygon(polygon, loop.samplePoints),
      included[0].samplePoints,
    );
}

/**
 * Handles clip polygon in the geometry flow.
 */
function clipPolygon(
  subject: [number, number][],
  clip: [number, number][],
): [number, number][] {
  let output = subject;
  const orientation = Math.sign(signedArea2d(clip)) || 1;
  for (const [a, b] of polygonEdges(clip)) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      const currentInside = insideHalfPlane(current, a, b, orientation);
      const previousInside = insideHalfPlane(previous, a, b, orientation);
      if (currentInside && !previousInside)
        output.push(lineIntersection(previous, current, a, b));
      if (currentInside) output.push(current);
      if (!currentInside && previousInside)
        output.push(lineIntersection(previous, current, a, b));
    }
  }
  return output;
}

/**
 * Handles inside half plane in the geometry flow.
 */
function insideHalfPlane(
  point: [number, number],
  a: [number, number],
  b: [number, number],
  orientation: number,
): boolean {
  const cross =
    (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  return orientation >= 0 ? cross >= -EPS : cross <= EPS;
}

/**
 * Handles region sort in the geometry flow.
 */
function regionSort(a: IRAtomicRegion, b: IRAtomicRegion): number {
  return (
    a.samplePoint[0] - b.samplePoint[0] ||
    a.samplePoint[1] - b.samplePoint[1] ||
    a.includeLoopIds.length - b.includeLoopIds.length
  );
}
