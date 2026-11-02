/**
 * @author Aidan Boissonneault
 * @file modifier-classification.ts
 * @purpose Provides modifier classification behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { BlendModifierOp, ModifierOp } from '../bridge/bridge-types.js';
import type { PartGroup } from '../core/program-utils.js';

/**
 * Returns whether the input meets the `modifier op` condition.
 */
export function isModifierOp(op: PartGroup['ops'][number]): op is ModifierOp {
  return op.kind === 'fillet' || op.kind === 'chamfer' || op.kind === 'draft';
}

/**
 * Handles modifier value in the operations flow.
 */
export function modifierValue(op: BlendModifierOp): number {
  return op.kind === 'fillet' ? op.radius : op.offset;
}

/**
 * Checks whether the supplied modifier value values are equivalent.
 */
export function sameModifierValue(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9;
}
