/**
 * @author Aidan Boissonneault
 * @file resolve-pattern-statements.ts
 * @purpose Resolves pattern statements for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { PatternLinearStmt, PatternRadialStmt } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFaceRef } from '../references/refs.js';
import { requireTargetObject } from './object-target-validation.js';

/**
 * Resolves pattern linear against the current scope and reports unresolved references.
 */
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

/**
 * Resolves pattern radial against the current scope and reports unresolved references.
 */
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
