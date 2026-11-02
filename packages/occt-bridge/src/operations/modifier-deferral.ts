/**
 * @author Aidan Boissonneault
 * @file modifier-deferral.ts
 * @purpose Provides modifier deferral behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  BlendModifierOp,
  GroupBuildState,
  ModifierOp,
} from '../bridge/bridge-types.js';
import { parseFaceRef } from '../core/program-utils.js';

/**
 * Decides whether explicit-part modifiers can run on deferred components.
 * Most deferred components can be modified independently and fused later, which
 * keeps repeated cuts fast. Additive feature seam blends are different: their
 * source face can be consumed by the final fuse, so edge recovery needs the
 * fused topology and the recorded attachment plane.
 */
export function canApplyDeferredPartModifiers(
  state: GroupBuildState,
  ops: ModifierOp[],
): boolean {
  return Boolean(
    state.partSolidOwner &&
    state.partSolidComponents.size > 2 &&
    !requiresFusedSourceEdgeRecovery(state, ops),
  );
}

/**
 * Deferred modifier split, including deferred prefix and fused suffix.
 */
type DeferredModifierSplit = {
  deferredPrefix: ModifierOp[];
  fusedSuffix: ModifierOp[];
};

/**
 * Splits a modifier batch at the first selector that needs fused topology.
 * A source-order prefix such as `base.top.edges` should still apply to the
 * source component, otherwise it can see later additive contact seams. Once a
 * placed additive seam selector appears, the remaining modifiers run on the
 * fused part so intentional multi-fillet seam combinations still work.
 */
export function splitDeferredPartModifiers(
  state: GroupBuildState,
  ops: ModifierOp[],
): DeferredModifierSplit {
  const firstFusedIndex = ops.findIndex(
    (op) => isBlendModifier(op) && additiveEdgeSelectorNeedsFuse(state, op),
  );
  if (firstFusedIndex < 0) {
    return { deferredPrefix: ops, fusedSuffix: [] };
  }
  return {
    deferredPrefix: ops.slice(0, firstFusedIndex),
    fusedSuffix: ops.slice(firstFusedIndex),
  };
}

/**
 * Detects blend selectors that must see the fused part topology.
 * A placed additive extrude starts from its local bottom face, so selectors
 * such as `flange.bottom.edges` describe the visible shoulder seam after the
 * fuse. Local top selectors still describe source-body edges and should remain
 * eligible for deferred component blending. Cut aliases are intentionally
 * excluded because their `inner` edge mode must remain anchored to
 * cutter-region topology for pocket and bore modifiers.
 */
export function requiresFusedSourceEdgeRecovery(
  state: GroupBuildState,
  ops: ModifierOp[],
): boolean {
  return ops.some(
    (op): op is BlendModifierOp =>
      isBlendModifier(op) && additiveEdgeSelectorNeedsFuse(state, op),
  );
}

/**
 * Handles additive edge selector needs fuse in the operations flow.
 */
function additiveEdgeSelectorNeedsFuse(
  state: GroupBuildState,
  op: BlendModifierOp,
): boolean {
  if (op.selection?.edgeIntersection) return true;
  const parsed = parseFaceRef(op.target);
  return (
    state.bodyEdgeModes.get(parsed.objName) === 'outer' &&
    hasAttachmentPlane(state, parsed.objName) &&
    parsed.face === 'bottom' &&
    (parsed.subRef === 'edges' ||
      parsed.subRef === 'perimeter' ||
      parsed.subRef === 'edge')
  );
}

/**
 * Checks whether the input has attachment plane.
 */
function hasAttachmentPlane(state: GroupBuildState, objName: string): boolean {
  return (
    state.partSolidAliasAttachmentPlanes.has(objName) ||
    state.bodyAttachmentPlanes.has(objName)
  );
}

/**
 * Returns whether the input meets the `blend modifier` condition.
 */
function isBlendModifier(op: ModifierOp): op is BlendModifierOp {
  return op.kind === 'fillet' || op.kind === 'chamfer';
}
