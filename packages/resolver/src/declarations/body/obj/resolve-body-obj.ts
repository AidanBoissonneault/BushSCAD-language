import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveObj } from '../../objects.js';

/**
 * Resolves body obj against the current scope and reports unresolved references.
 */
export function resolveBodyObj(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const obj = stmt as Extract<ComponentStatement, { kind: 'obj' }>;
  resolveObj(obj, scope, state);
  scope.define(obj.name, 'obj');
  for (const anchor of obj.anchors) scope.define(anchor.name, 'anchor');
}
