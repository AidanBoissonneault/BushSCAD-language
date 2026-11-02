/**
 * @author Aidan Boissonneault
 * @file interaction-op-semantics.ts
 * @purpose Provides interaction op semantics behavior for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IROp, ResolvedSelectionTarget } from '@bushscad/ir';
import {
  operationAccess,
  type OperationSelectionUsage,
} from '../pipeline/operation-access.js';

/**
 * Type used for interaction selection usage.
 */
export type InteractionSelectionUsage = OperationSelectionUsage;

/** Returns semantic entities produced or replaced by one concrete IR op. */
export function interactionOutputNames(op: IROp): string[] {
  return [...operationAccess(op).semanticOutputs];
}

/** Returns named semantic dependencies read by one concrete IR op. */
export function interactionInputNames(op: IROp): string[] {
  return [...operationAccess(op).semanticInputs];
}

/** Finds resolved selector targets embedded in an IR operation. */
export function interactionSelections(op: IROp): ResolvedSelectionTarget[] {
  return operationAccess(op).selections.map((usage) => usage.target);
}

/** Finds selector targets together with the evaluated placement using them. */
export function interactionSelectionUsages(
  op: IROp,
): InteractionSelectionUsage[] {
  return [...operationAccess(op).selections];
}
