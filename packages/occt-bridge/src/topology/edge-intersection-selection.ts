/**
 * @author Aidan Boissonneault
 * @file edge-intersection-selection.ts
 * @purpose Provides edge intersection selection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ResolvedSelectionTarget } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { getEdges, readBounds } from '../core/geometry-utils.js';
import { currentEdgeMembership } from './current-edge-membership.js';
import type { FaceLabelMap } from './face-labels.js';
import { registeredNamedEdges } from './sketch-component-selection.js';
import { sameTopoShape } from './shape-equality.js';
import { uniqueShapes } from './shape-collection.js';

/**
 * Result of edge intersection, including all and selected.
 */
export type EdgeIntersectionResult = {
  all: unknown[];
  selected: unknown[];
};

/**
 * Finds solid edges shared by both authored profile-edge memberships.
 * Boolean/extrude topology creates a vertical solid edge where two sketch
 * boundaries cross. Both authored edge labels already track that generated
 * edge, so intersecting their exact memberships is more stable than inferring
 * a crossing from tessellation or axis-aligned bounding boxes.
 */
export function selectEdgeIntersection(
  oc: OC,
  labels: FaceLabelMap,
  target: ResolvedSelectionTarget,
  ownerShape?: unknown,
): EdgeIntersectionResult {
  const intent = target.edgeIntersection;
  if (!intent) return { all: [], selected: [] };
  const currentShape = ownerShape ?? labels.getShape(target.ownerEntity);
  const currentEdges = currentShape ? getEdges(oc, currentShape) : [];
  const first = currentEdgeMembership(
    oc,
    currentEdges,
    operandEdges(oc, labels, target.ownerEntity, intent.edgeLabels[0]),
  );
  const second = currentEdgeMembership(
    oc,
    currentEdges,
    operandEdges(oc, labels, target.ownerEntity, intent.edgeLabels[1]),
  );
  const all = sortEdges(
    oc,
    uniqueShapes(
      first.filter((edge) =>
        second.some((candidate) => sameTopoShape(edge, candidate)),
      ),
    ),
  );
  const selected =
    intent.index === undefined
      ? all
      : all[intent.index]
        ? [all[intent.index]!]
        : [];
  return { all, selected };
}

/**
 * Handles operand edges in the topology flow.
 */
function operandEdges(
  oc: OC,
  labels: FaceLabelMap,
  owner: string,
  label: string,
): unknown[] {
  const prefix = `${owner}.`;
  const key = label.startsWith(prefix) ? label.slice(prefix.length) : label;
  const registered = registeredNamedEdges(labels, owner, key);
  return registered.length > 0 ? registered : labels.getBlendEdges(oc, label);
}

/** Builds the topology-aware failure used by modifier diagnostics. */
export function edgeIntersectionFailure(
  target: ResolvedSelectionTarget,
  result: EdgeIntersectionResult,
): string {
  const intent = target.edgeIntersection;
  if (!intent) return `No crossing edges matched '${target.label}'`;
  if (intent.index !== undefined && result.all.length > 0) {
    return `Edge intersection index ${intent.index} is out of range for ${result.all.length} crossing edge${result.all.length === 1 ? '' : 's'}`;
  }
  return `Named edges '${intent.edgeLabels[0]}' and '${intent.edgeLabels[1]}' do not cross on the modeled object`;
}

/**
 * Handles sort edges in the topology flow.
 */
function sortEdges(oc: OC, edges: unknown[]): unknown[] {
  return [...edges].sort((first, second) =>
    compareKeys(edgeGeometryKey(oc, first), edgeGeometryKey(oc, second)),
  );
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeGeometryKey(oc: OC, edge: unknown): number[] {
  try {
    const bounds = readBounds(oc, edge);
    return [
      bounds.xMin.current,
      bounds.yMin.current,
      bounds.zMin.current,
      bounds.xMax.current,
      bounds.yMax.current,
      bounds.zMax.current,
    ];
  } catch {
    return [0, 0, 0, 0, 0, 0];
  }
}

/**
 * Compares keys using the requested criteria.
 */
function compareKeys(
  first: readonly number[],
  second: readonly number[],
): number {
  for (let index = 0; index < first.length; index++) {
    const delta = (first[index] ?? 0) - (second[index] ?? 0);
    if (Math.abs(delta) > 1e-9) return delta;
  }
  return 0;
}
