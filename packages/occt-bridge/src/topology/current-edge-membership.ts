/**
 * @author Aidan Boissonneault
 * @file current-edge-membership.ts
 * @purpose Provides current edge membership behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';
import { readEdgeEndpoints, type Vec3 } from '../core/geometry-utils.js';
import { sameTopoShape } from './shape-equality.js';

/** Reselects recorded edges from the current owner shape by topology or endpoints. */
export function currentEdgeMembership(
  oc: OC,
  currentEdges: unknown[],
  registeredEdges: unknown[],
): unknown[] {
  if (currentEdges.length === 0) return registeredEdges;
  return currentEdges.filter((edge) =>
    registeredEdges.some(
      (registered) =>
        sameTopoShape(edge, registered) || endpointsMatch(oc, edge, registered),
    ),
  );
}

/**
 * Handles endpoints match in the topology flow.
 */
function endpointsMatch(oc: OC, first: unknown, second: unknown): boolean {
  try {
    const [firstStart, firstEnd] = readEdgeEndpoints(oc, first);
    const [secondStart, secondEnd] = readEdgeEndpoints(oc, second);
    return (
      (pointsNear(firstStart, secondStart) &&
        pointsNear(firstEnd, secondEnd)) ||
      (pointsNear(firstStart, secondEnd) && pointsNear(firstEnd, secondStart))
    );
  } catch {
    return false;
  }
}

/**
 * Handles points near in the topology flow.
 */
function pointsNear(first: Vec3, second: Vec3): boolean {
  return (
    Math.abs(first[0] - second[0]) <= 1e-3 &&
    Math.abs(first[1] - second[1]) <= 1e-3 &&
    Math.abs(first[2] - second[2]) <= 1e-3
  );
}
