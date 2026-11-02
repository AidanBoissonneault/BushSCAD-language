/**
 * @author Aidan Boissonneault
 * @file sketch-component-selection.ts
 * @purpose Provides sketch component selection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ResolvedSelectionTarget } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { getEdges } from '../core/geometry-utils.js';
import { currentEdgeMembership } from './current-edge-membership.js';
import type { FaceLabelMap } from './face-labels.js';
import { uniqueShapes } from './shape-collection.js';

/** Resolves one structured sketch-component member to current solid edges. */
export function selectSketchComponentEdges(
  oc: OC,
  labels: FaceLabelMap,
  target: ResolvedSelectionTarget,
  ownerShape?: unknown,
): unknown[] {
  const component = target.sketchComponent;
  if (!component) return [];
  const key = [...component.componentPath, component.member].join('.');
  const registered = registeredNamedEdges(labels, target.ownerEntity, key);
  const shape = ownerShape ?? labels.getShape(target.ownerEntity);
  return uniqueShapes(
    currentEdgeMembership(oc, shape ? getEdges(oc, shape) : [], registered),
  );
}

/** Reads an exact dotted label without routing it through face syntax parsing. */
export function registeredNamedEdges(
  labels: FaceLabelMap,
  owner: string,
  key: string,
): unknown[] {
  return (
    labels.getNamedFaceEdgeEntries(owner).find(([name]) => name === key)?.[1] ??
    []
  );
}
