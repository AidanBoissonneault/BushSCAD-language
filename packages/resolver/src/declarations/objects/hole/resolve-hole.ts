import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveThroughTarget } from '../../../references/operand-inputs.js';
import { resolveDepthAndFrom } from '../shared/resolve-depth-and-from.js';

/**
 * Resolves hole obj against the current scope and reports unresolved references.
 */
export function resolveHoleObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'hole' }>;
  resolveThroughTarget(op.through, scope, state, 'hole through-cut');
  resolveDepthAndFrom(op, scope, state);
}
