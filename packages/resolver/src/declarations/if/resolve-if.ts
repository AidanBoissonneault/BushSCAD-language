/**
 * Resolves conditional branches in independent child scopes.
 */
import type { IfStatement } from '@bushscad/ir';
import { Scope as ScopeClass } from '../../core/scope.js';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import type { BodyResolver } from '../body-resolver.js';
/**
 * Resolves if against the current scope and reports unresolved references.
 */
export function resolveIf(
  stmt: IfStatement,
  scope: Scope,
  state: State,
  resolveBody: BodyResolver,
): void {
  resolveExpr(stmt.condition, scope, state);
  resolveBody(
    stmt.then,
    new ScopeClass(scope),
    state,
    state.inComponent,
    false,
  );
  if (stmt.else)
    resolveBody(
      stmt.else,
      new ScopeClass(scope),
      state,
      state.inComponent,
      false,
    );
}
