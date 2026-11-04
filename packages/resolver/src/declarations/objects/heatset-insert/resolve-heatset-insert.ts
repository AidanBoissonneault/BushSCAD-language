/** Resolves the depth and placement arguments of a heat-set insert. */
import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveDepthAndFrom } from '../shared/resolve-depth-and-from.js';

export function resolveHeatsetInsert(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  resolveDepthAndFrom(
    stmt.operation as Extract<ObjDecl['operation'], { kind: 'heatset_insert' }>,
    scope,
    state,
  );
}
