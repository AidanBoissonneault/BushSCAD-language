import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveSurface } from '../../../geometry/surface.js';

/**
 * Resolves body surface against the current scope and reports unresolved references.
 */
export function resolveBodySurface(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const surface = stmt as Extract<ComponentStatement, { kind: 'surface' }>;
  resolveSurface(surface, scope, state);
  scope.define(surface.name, 'surface');
}
