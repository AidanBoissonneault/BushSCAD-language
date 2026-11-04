/** Resolves the target, angle, and optional reference axis of rotate. */
import type { RotateStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFaceRef } from '../../references/refs.js';
import { requireTargetObject } from '../object-target-validation.js';

/**
 * Resolves the target and axis reference of rotate in the current scope.
 * The language allows a named axis or a face reference, so only the latter
 * requires reference resolution.
 */
export function resolveRotate(
  stmt: RotateStatement,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'rotate');
  resolveExpr(stmt.angle, scope, state);
  if (typeof stmt.around !== 'string') {
    resolveFaceRef(
      stmt.around,
      scope,
      state,
      stmt.span,
      resolveExpr,
      'revolve-axis',
    );
  }
}
