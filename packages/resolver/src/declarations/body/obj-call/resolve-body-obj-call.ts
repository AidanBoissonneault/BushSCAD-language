import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveCall } from '../../call/resolve-call.js';

/**
 * Resolves body obj call against the current scope and reports unresolved references.
 */
export function resolveBodyObjCall(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const objCall = stmt as Extract<ComponentStatement, { kind: 'objCall' }>;
  resolveCall(objCall.call, objCall.span, scope, state);
  scope.define(objCall.name, 'obj');
}
