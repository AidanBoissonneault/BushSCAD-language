import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveCall } from '../../call/resolve-call.js';

/**
 * Resolves body call stmt against the current scope and reports unresolved references.
 */
export function resolveBodyCallStmt(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const callStmt = stmt as Extract<ComponentStatement, { kind: 'callStmt' }>;
  resolveCall(callStmt.call, callStmt.span, scope, state);
}
