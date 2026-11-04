/** Resolves the target, count, and axis of a radial pattern. */
import type { PatternRadialStmt } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFaceRef } from '../../references/refs.js';
import { requireTargetObject } from '../object-target-validation.js';

/** Resolves a radial pattern target, count, and axis reference. */
export function resolvePatternRadial(
  stmt: PatternRadialStmt,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'pattern');
  resolveExpr(stmt.count, scope, state);
  resolveFaceRef(
    stmt.around,
    scope,
    state,
    stmt.span,
    resolveExpr,
    'revolve-axis',
  );
}
