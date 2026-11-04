/** Owns call declaration resolution behavior. */
import { resolveCall } from './resolve-call.js';
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';

/**
 * Resolves obj call against the current scope and reports unresolved references.
 */
export function resolveObjCall(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const objCall = stmt as Extract<TopLevelStatement, { kind: 'objCall' }>;
  resolveCall(objCall.call, objCall.span, scope, state);
}
