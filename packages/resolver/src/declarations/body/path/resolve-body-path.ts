import type { ComponentStatement, PathDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolvePathDecl } from '../../resolve-path-declaration.js';

/**
 * Resolves body path against the current scope and reports unresolved references.
 */
export function resolveBodyPath(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const path = stmt as PathDecl;
  resolvePathDecl(path, scope, state);
  scope.define(path.name, 'path');
}
