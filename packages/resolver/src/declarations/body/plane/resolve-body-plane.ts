import type { ComponentStatement, PlaneDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolvePlane } from '../../plane/resolve-plane.js';

/**
 * Resolves body plane against the current scope and reports unresolved references.
 */
export function resolveBodyPlane(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const plane = stmt as PlaneDecl;
  resolvePlane(plane, scope, state);
  scope.define(plane.name, 'plane');
}
