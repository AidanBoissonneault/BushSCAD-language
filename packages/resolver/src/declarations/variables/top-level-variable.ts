/** Owns variable declaration resolution behavior. */
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { isSelectorNameValue } from '../../references/selector-vars.js';

/**
 * Resolves top var against the current scope and reports unresolved references.
 */
export function resolveTopVar(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const varStmt = stmt as Extract<TopLevelStatement, { kind: 'var' }>;
  if (!isSelectorNameValue(varStmt.value)) {
    resolveExpr(varStmt.value, scope, state);
  }
}
