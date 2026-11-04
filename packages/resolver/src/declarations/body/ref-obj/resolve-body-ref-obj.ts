import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveObj } from '../../objects.js';

/**
 * Resolves body ref obj against the current scope and reports unresolved references.
 */
export function resolveBodyRefObj(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const refObj = stmt as Extract<ComponentStatement, { kind: 'refObj' }>;
  resolveObj(
    {
      kind: 'obj',
      name: refObj.name,
      operation: refObj.operation,
      anchors: [],
      span: refObj.span,
    },
    scope,
    state,
  );
  scope.define(refObj.name, 'obj');
}
