import type { SolidPrimitiveOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFromRef } from '../../../references/refs.js';

/**
 * Resolves solid primitive op against the current scope and reports unresolved references.
 */
export function resolveSolidPrimitiveOp(
  op: SolidPrimitiveOp,
  scope: Scope,
  state: State,
): void {
  for (const arg of op.args) resolveExpr(arg.value, scope, state);
  if (op.placement) {
    resolveFromRef(op.placement, scope, state, op.span, resolveExpr);
  }
}
