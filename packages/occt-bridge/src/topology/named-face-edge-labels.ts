/**
 * @author Aidan Boissonneault
 * @file named-face-edge-labels.ts
 * @purpose Provides named face edge labels behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { pointOnProfileSegment, type IRProfileSegment } from '@bushscad/ir';
import type { FaceFrame, FaceLabelMap } from './face-labels.js';
import {
  getEdges,
  readEdgeEndpoints,
  type Vec3,
} from '../core/geometry-utils.js';
import { sameShape, uniqueShapes } from './shape-collection.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

const EDGE_MATCH_TOLERANCE = 1e-3;

/**
 * Copies named face-edge labels from a source shape to a transformed instance.
 * `place(refBody)` creates a new OCCT shape under a generated instance name.
 * Named sketch segment refs such as `body.crown.edges` must follow that placed
 * topology, so modifier selection uses edges from the instance, not stale
 * handles from the reusable source declaration.
 */
export function copyNamedFaceEdgesThroughTransform(
  oc: OC,
  labelMap: FaceLabelMap,
  sourceName: string,
  targetName: string,
  targetShape: unknown,
  transform: OC,
): void {
  const sourceLabels = labelMap.getNamedFaceEdgeEntries(sourceName);
  if (sourceLabels.length === 0) return;

  const targetEdges = getEdges(oc, targetShape);
  for (const [faceName, sourceEdges] of sourceLabels) {
    const transformedSeeds = sourceEdges.flatMap((edge) =>
      transformEdgeSeed(oc, edge, transform),
    );
    const matched = matchEdgesByEndpoints(oc, targetEdges, transformedSeeds);
    labelMap.registerNamedFaceEdges(
      targetName,
      faceName,
      matched.length > 0 ? matched : transformedSeeds,
    );
  }
}

/**
 * Filters body edges down to the boundary of one extruded profile segment.
 * Profile segment names represent generated side surfaces. Registering every
 * body edge for every segment makes selectors like `crown.edges` imprecise and
 * can round unrelated sides.
 */
export function filterEdgesForExtrudedProfileSegment(
  oc: OC,
  edges: unknown[],
  segment: IRProfileSegment,
  frame: FaceFrame,
): unknown[] {
  const filtered = matchEdgesForExtrudedProfileSegment(
    oc,
    edges,
    segment,
    frame,
  );
  return filtered.length > 0 ? filtered : edges;
}

/**
 * Finds body edges belonging to one extruded segment without a broad fallback.
 * Existing authored profiles retain their historical all-edge fallback when
 * topology matching fails. Inferred primitive aliases must instead fail
 * closed so a removed Boolean side never aliases the entire result body.
 */
export function matchEdgesForExtrudedProfileSegment(
  oc: OC,
  edges: unknown[],
  segment: IRProfileSegment,
  frame: FaceFrame,
): unknown[] {
  return edges.filter((edge) => {
    try {
      const [first, last] = readEdgeEndpoints(oc, edge);
      return edgeBelongsToExtrudedSegment(first, last, segment, frame);
    } catch {
      return false;
    }
  });
}

/**
 * Handles transform edge seed in the topology flow.
 */
function transformEdgeSeed(oc: OC, edge: unknown, transform: OC): unknown[] {
  try {
    const builder = new oc.BRepBuilderAPI_Transform_2(edge, transform, true);
    const shape = oc.TopoDS.Edge_1(builder.Shape());
    builder.delete?.();
    return [shape];
  } catch {
    return [];
  }
}

/**
 * Handles match edges by endpoints in the topology flow.
 */
function matchEdgesByEndpoints(
  oc: OC,
  candidates: unknown[],
  seeds: unknown[],
): unknown[] {
  const matched: unknown[] = [];
  for (const candidate of candidates) {
    if (
      seeds.some(
        (seed) =>
          sameShape(candidate, seed) ||
          safeEdgeMatch(() => endpointsMatch(oc, candidate, seed)),
      )
    ) {
      matched.push(candidate);
    }
  }
  return uniqueEdges(matched);
}

/**
 * Handles endpoints match in the topology flow.
 */
function endpointsMatch(oc: OC, candidate: unknown, seed: unknown): boolean {
  const [candidateA, candidateB] = readEdgeEndpoints(oc, candidate);
  const [seedA, seedB] = readEdgeEndpoints(oc, seed);
  return (
    (pointsNear(candidateA, seedA) && pointsNear(candidateB, seedB)) ||
    (pointsNear(candidateA, seedB) && pointsNear(candidateB, seedA))
  );
}

/**
 * Checks whether a body edge belongs to one extruded profile segment.
 * Adjacent side faces share endpoints. A one-endpoint test overselects the
 * neighboring side edges, while the intended side boundary has both projected
 * endpoints on the segment or is the vertical seam at a segment endpoint.
 */
function edgeBelongsToExtrudedSegment(
  first: Vec3,
  last: Vec3,
  segment: IRProfileSegment,
  frame: FaceFrame,
): boolean {
  const firstProjected = projectProfilePoint(first, frame);
  const lastProjected = projectProfilePoint(last, frame);
  return (
    bothEndpointsOnSegment(firstProjected, lastProjected, segment) ||
    verticalAtSegmentEndpoint(firstProjected, lastProjected, segment)
  );
}

/**
 * Handles both endpoints on segment in the topology flow.
 */
function bothEndpointsOnSegment(
  first: readonly [number, number],
  last: readonly [number, number],
  segment: IRProfileSegment,
): boolean {
  return (
    pointOnProfileSegment(first, segment, EDGE_MATCH_TOLERANCE) &&
    pointOnProfileSegment(last, segment, EDGE_MATCH_TOLERANCE)
  );
}

/**
 * Handles vertical at segment endpoint in the topology flow.
 */
function verticalAtSegmentEndpoint(
  first: readonly [number, number],
  last: readonly [number, number],
  segment: IRProfileSegment,
): boolean {
  return (
    (point2Near(first, segment.from) && point2Near(last, segment.from)) ||
    (point2Near(first, segment.to) && point2Near(last, segment.to))
  );
}

/**
 * Handles project profile point in the topology flow.
 */
function projectProfilePoint(point: Vec3, frame: FaceFrame): [number, number] {
  return [dot(point, frame.x), dot(point, frame.y)];
}

/**
 * Handles point2 near in the topology flow.
 */
function point2Near(
  a: readonly [number, number],
  b: readonly [number, number],
): boolean {
  return (
    Math.abs(a[0] - b[0]) <= EDGE_MATCH_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= EDGE_MATCH_TOLERANCE
  );
}

/**
 * Handles points near in the topology flow.
 */
function pointsNear(a: Vec3, b: Vec3): boolean {
  return (
    Math.abs(a[0] - b[0]) <= EDGE_MATCH_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= EDGE_MATCH_TOLERANCE &&
    Math.abs(a[2] - b[2]) <= EDGE_MATCH_TOLERANCE
  );
}

/**
 * Returns the dot product of the supplied vectors.
 */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Handles safe edge match in the topology flow.
 */
function safeEdgeMatch(check: () => boolean): boolean {
  try {
    return check();
  } catch {
    return false;
  }
}

/**
 * Removes duplicate edges values while preserving their first occurrence.
 */
function uniqueEdges(edges: unknown[]): unknown[] {
  return uniqueShapes(edges);
}
