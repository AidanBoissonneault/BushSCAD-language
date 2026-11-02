/**
 * @author Aidan Boissonneault
 * @file circularArcLoop.ts
 * @purpose Provides circular arc loop behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { arcCenterCandidates } from './geometry.js';
import { circularArcEndpointKeys } from './circularArcVertices.js';

/**
 * Circular arc, including from, to, radius, and clockwise.
 */
export type CircularArc = {
  from: [number, number];
  to: [number, number];
  radius: number;
  clockwise: boolean;
};

/**
 * Accepted values for circular arc loop failure reason are 'wrong-segment-count', 'degenerate',
 * 'open-loop', 'mixed-radius', 'mixed-center', 'inconsistent-winding', and
 * 'not-full-revolution'.
 */
export type CircularArcLoopFailureReason =
  | 'wrong-segment-count'
  | 'degenerate'
  | 'open-loop'
  | 'mixed-radius'
  | 'mixed-center'
  | 'inconsistent-winding'
  | 'not-full-revolution';

/**
 * Circular arc loop analysis accepts { recognized: true; center: [number, number]; radi and {
 * recognized: false; reason: CircularArcLoopFailur.
 */
export type CircularArcLoopAnalysis =
  | {
      recognized: true;
      center: [number, number];
      radius: number;
      endpointKeys: { from: string; to: string }[];
    }
  | { recognized: false; reason: CircularArcLoopFailureReason };

/**
 * Type used for oriented arc.
 */
type OrientedArc = CircularArc;

const FULL_TURN = Math.PI * 2;

/**
 * Proves that radius arcs form one exact circular revolution.
 * Sketch minification and OCCT edge coalescing must agree about when an arc
 * chain is safely equivalent to one circle. The proof ignores declaration
 * order and direction while rejecting gaps, repeated coverage, and mixed
 * geometric intent.
 */
export function analyzeCircularArcLoop(
  arcs: CircularArc[],
  tolerance = 1e-7,
): CircularArcLoopAnalysis {
  if (arcs.length < 2) return failure('wrong-segment-count');
  if (!arcs.every((arc) => validArc(arc, tolerance))) {
    return failure('degenerate');
  }
  const vertexKeys = circularArcEndpointKeys(arcs, tolerance);
  const ordered = orderedArcCycle(arcs, vertexKeys);
  if (!ordered) return failure('open-loop');
  if (!joinsAreClosed(ordered, tolerance)) {
    return failure('open-loop');
  }
  if (!ordered.every((arc) => arc.clockwise === ordered[0].clockwise)) {
    return failure('inconsistent-winding');
  }
  const radius = stableAverage(ordered.map((arc) => arc.radius));
  if (!ordered.every((arc) => near(arc.radius, radius, tolerance))) {
    return failure('mixed-radius');
  }
  const centers = ordered.map((arc) => directedArcCenter(arc));
  if (centers.some((candidate) => !candidate)) {
    return failure('degenerate');
  }
  const exactCenters = centers.filter(
    (candidate): candidate is [number, number] => candidate !== null,
  );
  const center = averagePoint(exactCenters);
  if (
    centers.some(
      (candidate) => !candidate || pointDistance(candidate, center) > tolerance,
    ) ||
    ordered.some(
      (arc) =>
        !pointHasRadius(arc.from, center, radius, tolerance) ||
        !pointHasRadius(arc.to, center, radius, tolerance),
    )
  ) {
    return failure('mixed-center');
  }
  const sweep = ordered.reduce(
    (sum, arc) => sum + directedArcSweep(center, arc),
    0,
  );
  const angleTolerance = tolerance * Math.max(10, ordered.length * 4);
  if (Math.abs(sweep - FULL_TURN) > angleTolerance) {
    return failure('not-full-revolution');
  }
  return {
    recognized: true,
    center,
    radius,
    endpointKeys: vertexKeys,
  };
}

/** Resolves the minor-sweep center selected by an arc's direction. */
export function directedArcCenter(arc: CircularArc): [number, number] | null {
  const candidates = arcCenterCandidates(arc.from, arc.to, arc.radius);
  if (!candidates) return null;
  return (
    candidates.find(
      (center) => directedArcSweep(center, arc) <= Math.PI + 1e-10,
    ) ?? candidates[0]
  );
}

/**
 * Handles ordered arc cycle in the geometry flow.
 */
function orderedArcCycle(
  arcs: CircularArc[],
  keys: { from: string; to: string }[],
): OrientedArc[] | null {
  const incident = arcIncidence(keys);
  if (!incidenceIsOneCycle(incident, arcs.length)) return null;
  const startVertex = [...incident.keys()].sort()[0];
  const firstIndex = Math.min(...(incident.get(startVertex) ?? []));
  return walkArcCycle(arcs, keys, incident, startVertex, firstIndex);
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcIncidence(
  keys: { from: string; to: string }[],
): Map<string, number[]> {
  const incident = new Map<string, number[]>();
  keys.forEach(({ from, to }, index) => {
    if (from === to) return;
    incident.set(from, [...(incident.get(from) ?? []), index]);
    incident.set(to, [...(incident.get(to) ?? []), index]);
  });
  return incident;
}

/**
 * Handles incidence is one cycle in the geometry flow.
 */
function incidenceIsOneCycle(
  incident: Map<string, number[]>,
  arcCount: number,
): boolean {
  return (
    incident.size === arcCount &&
    [...incident.values()].every((indices) => indices.length === 2)
  );
}

/**
 * Handles walk arc cycle in the geometry flow.
 */
function walkArcCycle(
  arcs: CircularArc[],
  keys: { from: string; to: string }[],
  incident: Map<string, number[]>,
  startVertex: string,
  firstIndex: number,
): OrientedArc[] | null {
  const used = new Set<number>();
  const ordered: OrientedArc[] = [];
  let vertex = startVertex;
  let arcIndex = firstIndex;
  while (!used.has(arcIndex)) {
    used.add(arcIndex);
    const oriented = orientArc(arcs[arcIndex], keys[arcIndex], vertex);
    if (!oriented) return null;
    ordered.push(oriented.arc);
    vertex = oriented.nextVertex;
    const next = (incident.get(vertex) ?? []).find((index) => !used.has(index));
    if (next === undefined) break;
    arcIndex = next;
  }
  return used.size === arcs.length && vertex === startVertex ? ordered : null;
}

/**
 * Handles orient arc in the geometry flow.
 */
function orientArc(
  arc: CircularArc,
  keys: { from: string; to: string },
  vertex: string,
): { arc: OrientedArc; nextVertex: string } | null {
  if (keys.from === vertex) {
    return { arc, nextVertex: keys.to };
  }
  if (keys.to !== vertex) return null;
  return {
    arc: {
      from: arc.to,
      to: arc.from,
      radius: arc.radius,
      clockwise: !arc.clockwise,
    },
    nextVertex: keys.from,
  };
}

/**
 * Returns a valid arc value, or null when no candidate is usable.
 */
function validArc(arc: CircularArc, tolerance: number): boolean {
  const chord = pointDistance(arc.from, arc.to);
  return (
    Number.isFinite(arc.radius) &&
    arc.radius > tolerance &&
    chord > tolerance &&
    chord <= arc.radius * 2 + tolerance
  );
}

/**
 * Handles joins are closed in the geometry flow.
 */
function joinsAreClosed(arcs: OrientedArc[], tolerance: number): boolean {
  return arcs.every(
    (arc, index) =>
      pointDistance(arc.to, arcs[(index + 1) % arcs.length].from) <= tolerance,
  );
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointHasRadius(
  point: [number, number],
  center: [number, number],
  radius: number,
  tolerance: number,
): boolean {
  return near(pointDistance(point, center), radius, tolerance);
}

/**
 * Handles directed arc sweep in the geometry flow.
 */
function directedArcSweep(center: [number, number], arc: CircularArc): number {
  const start = Math.atan2(arc.from[1] - center[1], arc.from[0] - center[0]);
  const end = Math.atan2(arc.to[1] - center[1], arc.to[0] - center[0]);
  return normalizeAngle(arc.clockwise ? start - end : end - start);
}

/**
 * Normalizes angle into the canonical form.
 */
function normalizeAngle(angle: number): number {
  let normalized = angle;
  while (normalized < 0) normalized += FULL_TURN;
  while (normalized >= FULL_TURN) normalized -= FULL_TURN;
  return normalized;
}

/**
 * Handles near in the geometry flow.
 */
function near(first: number, second: number, tolerance: number): boolean {
  return Math.abs(first - second) <= tolerance;
}

/**
 * Handles average point in the geometry flow.
 */
function averagePoint(points: [number, number][]): [number, number] {
  return [
    stableAverage(points.map((point) => point[0])),
    stableAverage(points.map((point) => point[1])),
  ];
}

/**
 * Handles stable average in the geometry flow.
 */
function stableAverage(values: number[]): number {
  const ordered = [...values].sort((first, second) => first - second);
  return ordered.reduce((sum, value) => sum + value, 0) / ordered.length;
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointDistance(
  first: [number, number],
  second: [number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

/**
 * Handles failure in the geometry flow.
 */
function failure(
  reason: CircularArcLoopFailureReason,
): CircularArcLoopAnalysis {
  return { recognized: false, reason };
}
