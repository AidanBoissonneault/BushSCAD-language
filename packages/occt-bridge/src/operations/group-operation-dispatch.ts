/**
 * @author Aidan Boissonneault
 * @file group-operation-dispatch.ts
 * @purpose Provides group operation dispatch behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IROp } from '@bushscad/ir';

/**
 * Optional fields from { [Kind in IROp['kind']]: (op: Extract<IROp, { kind: Kind }>) => void; }
 * used for group operation handlers.
 */
export type GroupOperationHandlers = Partial<{
  [Kind in IROp['kind']]: (op: Extract<IROp, { kind: Kind }>) => void;
}>;

/**
 * Applies one group operation through a typed handler table.
 * Group operation routing is a full discriminated-union dispatch. Keeping the
 * dispatch mechanics here avoids a large switch in the bridge while preserving
 * operation-specific handlers next to the private bridge methods they call.
 */
export function applyDispatchedGroupOperation(
  handlers: GroupOperationHandlers,
  op: IROp,
): void {
  const handler = handlers[op.kind] as (operation: IROp) => void;
  if (!handler) return;
  handler(op);
}
