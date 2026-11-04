import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { isSelectorNameValue } from '../../../references/selector-vars.js';

/**
 * Resolves body var against the current scope and reports unresolved references.
 */
export function resolveBodyVar(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const varStmt = stmt as Extract<ComponentStatement, { kind: 'var' }>;
  if (!isSelectorNameValue(varStmt.value)) {
    resolveExpr(varStmt.value, scope, state);
  }
  scope.define(varStmt.name, 'var');
}
