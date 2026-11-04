import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import { Scope as ScopeClass } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import type { BodyResolver } from '../../body-resolver.js';

/**
 * Resolves body ref part against the current scope and reports unresolved references.
 */
export function resolveBodyRefPart(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
  resolveBody: BodyResolver,
): void {
  const refPart = stmt as Extract<ComponentStatement, { kind: 'refPart' }>;
  resolveBody(refPart.body, new ScopeClass(scope), state, true, true);
  scope.define(refPart.name, 'component');
}
