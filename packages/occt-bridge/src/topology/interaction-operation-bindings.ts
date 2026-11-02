/**
 * @author Aidan Boissonneault
 * @file interaction-operation-bindings.ts
 * @purpose Provides interaction operation bindings behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { InteractionSnapshot } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import type { FaceLabelMap } from './face-labels.js';

const CUT_EFFECTS = new Set(['cut', 'solid_cut', 'radial_cut', 'sweep_cut']);

/** Returns whether an entity is the direct semantic output of a subtractive op. */
export function isCutResultEntity(
  snapshot: InteractionSnapshot | undefined,
  entityId: string,
): boolean {
  return (
    snapshot?.effects.some(
      (effect) =>
        CUT_EFFECTS.has(effect.kind) &&
        effect.outputEntityIds.includes(entityId),
    ) ?? false
  );
}

/**
 * Resolves only the inner region faces produced by one cut alias.
 * A bare cut object alias maps to the running part shape, while interaction
 * highlighting needs the cavity walls/floor represented by its inner selectors.
 */
export function cutResultFaceHandles(
  _oc: OC,
  labels: FaceLabelMap,
  name: string,
): unknown[] {
  return labels.getFeatureFaceHandles(name);
}

/** Resolves the boundary edges belonging to a cut result's inner faces. */
export function cutResultEdgeHandles(
  oc: OC,
  labels: FaceLabelMap,
  name: string,
): unknown[] {
  return labels.getFeatureEdgeHandles(oc, name);
}
