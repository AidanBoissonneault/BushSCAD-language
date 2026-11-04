import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveFn } from '../../functions.js';

/**
 * Resolves body fn against the current scope and reports unresolved references.
 */
export function resolveBodyFn(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const fn = stmt as Extract<ComponentStatement, { kind: 'fn' }>;
  resolveFn(fn, scope, state);
  scope.define(fn.name, 'fn');
}
