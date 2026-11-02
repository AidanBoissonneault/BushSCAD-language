/**
 * @author Aidan Boissonneault
 * @file source-edge-recovery.ts
 * @purpose Provides source edge recovery behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { FaceFrame } from './face-labels.js';
import { dotVec, normalizeVec } from './frame-utils.js';
import {
  getEdges,
  readEdgeEndpoints,
  type Vec3,
} from '../core/geometry-utils.js';
import { sameTopoShape } from './shape-equality.js';
import type { OC } from '../bridge/bridge-types.js';
import {
  distanceFromLine,
  projectionRange,
  rangesOverlap,
  subtractVec,
} from '../core/vector-math.js';

const PLANE_TOLERANCE = 0.08;
const LINE_TOLERANCE = 0.25;

/**
 * Source attachment plane, including origin and normal.
 */
export type SourceAttachmentPlane = {
  origin: Vec3;
  normal: Vec3;
};

/**
 * Input for consumed source edge recovery, including oc, shape, frame, source edges, and
 * attachment plane.
 */
type ConsumedSourceEdgeRecoveryInput = {
  oc: OC;
  shape: unknown;
  frame: FaceFrame;
  sourceEdges: unknown[];
  attachmentPlane?: SourceAttachmentPlane;
};

/**
 * Recovers source face edges that disappeared into an additive fuse.
 * A placed feature's bottom face is often consumed by the fused part. The
 * user-facing selector still means the visible shoulder seam at the original
 * placement plane, so source boundary edges are projected onto that plane and
 * matched against current fused topology.
 */
export function recoverConsumedSourceEdges({
  oc,
  shape,
  frame,
  sourceEdges,
  attachmentPlane,
}: ConsumedSourceEdgeRecoveryInput): unknown[] {
  if (!attachmentPlane || sourceEdges.length === 0) return [];
  const planeZ = dotVec(attachmentPlane.origin, frame.z);
  const projectedSeeds = sourceEdges
    .map((edge) => projectEdgeToPlane(oc, edge, frame, planeZ))
    .filter((edge): edge is ProjectedEdge => edge !== null);
  if (projectedSeeds.length === 0) return [];

  return uniqueEdges(
    getEdges(oc, shape).filter((candidate) =>
      projectedSeeds.some((seed) =>
        edgeMatchesProjectedSource(oc, candidate, frame, planeZ, seed),
      ),
    ),
  );
}

/**
 * Projected edge, including first, last, and dir.
 */
type ProjectedEdge = {
  first: Vec3;
  last: Vec3;
  dir: Vec3;
};

/**
 * Handles project edge to plane in the topology flow.
 */
function projectEdgeToPlane(
  oc: OC,
  edge: unknown,
  frame: FaceFrame,
  planeZ: number,
): ProjectedEdge | null {
  try {
    const [first, last] = readEdgeEndpoints(oc, edge).map((point) =>
      toLocal(point, frame),
    ) as [Vec3, Vec3];
    first[2] = planeZ;
    last[2] = planeZ;
    const dir = normalizeVec(subtractVec(last, first));
    if (!dir) return null;
    return { first, last, dir };
  } catch {
    return null;
  }
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeMatchesProjectedSource(
  oc: OC,
  candidate: unknown,
  frame: FaceFrame,
  planeZ: number,
  seed: ProjectedEdge,
): boolean {
  try {
    const [first, last] = readEdgeEndpoints(oc, candidate).map((point) =>
      toLocal(point, frame),
    ) as [Vec3, Vec3];
    if (
      Math.abs(first[2] - planeZ) > PLANE_TOLERANCE ||
      Math.abs(last[2] - planeZ) > PLANE_TOLERANCE
    ) {
      return false;
    }
    const candidateDir = normalizeVec(subtractVec(last, first));
    if (!candidateDir || Math.abs(dotVec(candidateDir, seed.dir)) < 0.985) {
      return false;
    }
    if (
      distanceFromLine(first, seed.first, seed.dir) > LINE_TOLERANCE ||
      distanceFromLine(last, seed.first, seed.dir) > LINE_TOLERANCE
    ) {
      return false;
    }
    return rangesOverlap(
      projectionRange(seed.first, seed.last, seed.first, seed.dir),
      projectionRange(first, last, seed.first, seed.dir),
      LINE_TOLERANCE,
    );
  } catch {
    return false;
  }
}

/**
 * Removes duplicate edges values while preserving their first occurrence.
 */
function uniqueEdges(edges: unknown[]): unknown[] {
  const result: unknown[] = [];
  for (const edge of edges) {
    if (!result.some((existing) => sameTopoShape(existing, edge))) {
      result.push(edge);
    }
  }
  return result;
}

/**
 * Converts the supplied value to its local representation.
 */
function toLocal(point: Vec3, frame: FaceFrame): Vec3 {
  return [
    dotVec(point, frame.x),
    dotVec(point, frame.y),
    dotVec(point, frame.z),
  ];
}
