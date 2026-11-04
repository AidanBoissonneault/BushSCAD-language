/** Owns part declaration resolution behavior. */
import { resolveBody } from '../body/resolve-body.js';
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { Scope as ScopeClass } from '../../core/scope.js';

/**
 * Resolves top part against the current scope and reports unresolved references.
 */
export function resolveTopPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const part = stmt as Extract<TopLevelStatement, { kind: 'part' }>;
  resolveBody(part.body, new ScopeClass(scope), state, true, true);
}
