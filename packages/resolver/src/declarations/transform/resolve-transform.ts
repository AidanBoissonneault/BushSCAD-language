/** Resolves the target and expressions of transform operations. */
import type { TransformStmt } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFaceRef } from '../../references/refs.js';
import { requireTargetObject } from '../object-target-validation.js';

/** Resolves the target and every expression used by a transform operation. */
export function resolveTransform(
  stmt: TransformStmt,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'transform');
  const op = stmt.operation;
  if (op.kind === 'translate') {
    if (op.x) resolveExpr(op.x, scope, state);
    if (op.y) resolveExpr(op.y, scope, state);
    if (op.z) resolveExpr(op.z, scope, state);
  } else if (op.kind === 'rotate') {
    resolveExpr(op.angle, scope, state);
    if (typeof op.around !== 'string') {
      resolveFaceRef(
        op.around,
        scope,
        state,
        stmt.span,
        resolveExpr,
        'revolve-axis',
      );
    }
  } else if (op.kind === 'scale') {
    resolveExpr(op.factor, scope, state);
  }
}
