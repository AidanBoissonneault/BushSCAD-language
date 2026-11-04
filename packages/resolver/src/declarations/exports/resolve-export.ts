/** Owns export declaration resolution behavior. */
import type { TopStmtContext } from '../top-level-context.js';
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';

/**
 * Resolves export against the current scope and reports unresolved references.
 */
export function resolveExport(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
  context: TopStmtContext,
): void {
  const exportStmt = stmt as Extract<TopLevelStatement, { kind: 'export' }>;
  context.resolveTopStmt(exportStmt.statement, scope, state, context);
}
