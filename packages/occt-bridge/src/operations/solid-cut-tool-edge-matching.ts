/**
 * @author Aidan Boissonneault
 * @file solid-cut-tool-edge-matching.ts
 * @purpose Provides solid cut tool edge matching behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { EdgeSelection, OC } from '../bridge/bridge-types.js';
import { getEdges, readBounds, type Bounds } from '../core/geometry-utils.js';
import { sameTopoShape } from '../topology/shape-equality.js';

const EDGE_MATCH_TOLERANCE = 0.5;
const AXES = [0, 1, 2] as const;
/**
 * Derives `Axis` from `(typeof AXES)[number]` to preserve its type relationship in the operations
 * layer.
 */
type Axis = (typeof AXES)[number];

/**
 * Edge box, including min, max, and size.
 */
export type EdgeBox = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
};

/**
 * Maps each selected cut-result edge back to its source loft-tool edge.
 *
 * Why: the boolean result can split a closed cutter rim into several handles,
 * while the original loft still owns the single closed edge needed for a
 * stable native OCCT blend.
 */
export function matchSolidCutToolBlendSelections(
  oc: OC,
  selections: EdgeSelection[],
  toolShape: OC,
): EdgeSelection[] | null {
  const toolEdges = getEdges(oc, toolShape);
  const mapped: EdgeSelection[] = [];
  const mappedEdges = new Set<unknown>();
  let ownershipTransferred = false;

  try {
    for (const selection of selections) {
      const selectedBox = tryReadEdgeBox(oc, selection.edge);
      if (!selectedBox) return null;

      const candidates = toolEdges.filter((candidate) =>
        toolEdgeMatchesSelection(oc, candidate, selection.edge, selectedBox),
      );
      if (candidates.length === 0) return null;

      for (const edge of candidates) {
        const duplicate = mapped.find((existing) =>
          sameMappedEdge(oc, existing.edge, edge),
        );
        if (duplicate) {
          if (
            duplicate.value !== selection.value ||
            duplicate.target !== selection.target
          ) {
            return null;
          }
          continue;
        }
        mapped.push({ ...selection, edge });
        mappedEdges.add(edge);
      }
    }

    ownershipTransferred = true;
    return mapped;
  } finally {
    for (const edge of toolEdges) {
      if (!ownershipTransferred || !mappedEdges.has(edge)) {
        (edge as { delete?: () => void })?.delete?.();
      }
    }
  }
}

/**
 * Matches a cutter candidate by topology or by the selected edge's bounds.
 *
 * Why: booleans often return new topology handles even when the edge geometry
 * is unchanged; partial-result edges can still be identified inside the
 * selected planar boundary.
 */
function toolEdgeMatchesSelection(
  oc: OC,
  candidate: unknown,
  selected: unknown,
  selectedBox: EdgeBox,
): boolean {
  if (sameTopoShape(candidate, selected)) return true;

  const candidateBox = tryReadEdgeBox(oc, candidate);
  if (!candidateBox) return false;
  if (boxesNearlyEqual(candidateBox, selectedBox, EDGE_MATCH_TOLERANCE)) {
    return true;
  }

  const planeAxis = flatPlaneAxis(selectedBox);
  return (
    candidateSharesSelectedPlane(candidateBox, selectedBox, planeAxis) &&
    candidateIsInsideSelectedEnvelope(candidateBox, selectedBox, planeAxis) &&
    candidateTouchesSelectedBoundary(candidateBox, selectedBox, planeAxis)
  );
}

/**
 * Avoids adding duplicate edge handles for the same mapped contour.
 *
 * Why: a closed rim can be exposed more than once by OCCT exploration after a
 * boolean, but the blend builder should receive it only once.
 */
function sameMappedEdge(oc: OC, first: unknown, second: unknown): boolean {
  if (sameTopoShape(first, second)) return true;
  const firstBox = tryReadEdgeBox(oc, first);
  const secondBox = tryReadEdgeBox(oc, second);
  return Boolean(
    firstBox &&
    secondBox &&
    boxesNearlyEqual(firstBox, secondBox, EDGE_MATCH_TOLERANCE),
  );
}

/**
 * Attempts to read edge box and reports whether it succeeds.
 */
function tryReadEdgeBox(oc: OC, edge: unknown): EdgeBox | null {
  try {
    return edgeBoxFromBounds(readBounds(oc, edge));
  } catch {
    return null;
  }
}

/**
 * Reads a shape's OCCT bounds into the tuple form used by edge matching.
 *
 * Why: current cut aliases can receive fresh OCCT handles while preserving
 * their geometry, so the blend route needs a stable bounds comparison.
 */
export function readBox(oc: OC, shape: unknown): EdgeBox {
  return edgeBoxFromBounds(readBounds(oc, shape));
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeBoxFromBounds(bounds: Bounds): EdgeBox {
  const min: [number, number, number] = [
    bounds.xMin.current,
    bounds.yMin.current,
    bounds.zMin.current,
  ];
  const max: [number, number, number] = [
    bounds.xMax.current,
    bounds.yMax.current,
    bounds.zMax.current,
  ];
  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
}

/**
 * Handles flat plane axis in the operations flow.
 */
function flatPlaneAxis(box: EdgeBox): Axis {
  return AXES.reduce((best, axis) =>
    box.size[axis] < box.size[best] ? axis : best,
  );
}

/**
 * Handles candidate shares selected plane in the operations flow.
 */
function candidateSharesSelectedPlane(
  candidate: EdgeBox,
  selected: EdgeBox,
  planeAxis: Axis,
): boolean {
  return (
    Math.abs(
      (candidate.min[planeAxis] + candidate.max[planeAxis]) / 2 -
        (selected.min[planeAxis] + selected.max[planeAxis]) / 2,
    ) <= EDGE_MATCH_TOLERANCE &&
    candidate.size[planeAxis] <= selected.size[planeAxis] + EDGE_MATCH_TOLERANCE
  );
}

/**
 * Handles candidate is inside selected envelope in the operations flow.
 */
function candidateIsInsideSelectedEnvelope(
  candidate: EdgeBox,
  selected: EdgeBox,
  planeAxis: Axis,
): boolean {
  return AXES.every((axis) => {
    if (axis === planeAxis) return true;
    return (
      candidate.min[axis] >= selected.min[axis] - EDGE_MATCH_TOLERANCE &&
      candidate.max[axis] <= selected.max[axis] + EDGE_MATCH_TOLERANCE
    );
  });
}

/**
 * Handles candidate touches selected boundary in the operations flow.
 */
function candidateTouchesSelectedBoundary(
  candidate: EdgeBox,
  selected: EdgeBox,
  planeAxis: Axis,
): boolean {
  return AXES.some((axis) => {
    if (axis === planeAxis) return false;
    return (
      nearlyEqual(candidate.min[axis], selected.min[axis]) ||
      nearlyEqual(candidate.max[axis], selected.max[axis])
    );
  });
}

/**
 * Checks whether two OCCT bounds identify the same geometric edge.
 *
 * Why: topology identity is not preserved across booleans, while small numeric
 * tolerances account for OCCT's bounding-box precision.
 */
export function boxesNearlyEqual(
  first: EdgeBox,
  second: EdgeBox,
  tolerance: number,
): boolean {
  return AXES.every(
    (axis) =>
      nearlyEqual(first.min[axis], second.min[axis], tolerance) &&
      nearlyEqual(first.max[axis], second.max[axis], tolerance),
  );
}

/**
 * Handles nearly equal in the operations flow.
 */
function nearlyEqual(
  first: number,
  second: number,
  tolerance = EDGE_MATCH_TOLERANCE,
): boolean {
  return Math.abs(first - second) <= tolerance;
}
