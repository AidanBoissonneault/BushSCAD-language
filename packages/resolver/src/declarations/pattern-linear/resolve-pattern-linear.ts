/** Resolves the target and spacing/count expressions of a linear pattern. */
import type { PatternLinearStmt } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { requireTargetObject } from '../object-target-validation.js';

/** Resolves a linear pattern target, counts, and spacing expressions. */
export function resolvePatternLinear(
  stmt: PatternLinearStmt,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'pattern');
  resolveExpr(stmt.countX, scope, state);
  if (stmt.countY) resolveExpr(stmt.countY, scope, state);
  resolveExpr(stmt.spacingX, scope, state);
  if (stmt.spacingY) resolveExpr(stmt.spacingY, scope, state);
}
