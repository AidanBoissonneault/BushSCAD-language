import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveDepthAndFrom } from '../shared/resolve-depth-and-from.js';
import {
  resolvePathInput,
  resolveSketchInput,
  resolveThroughTarget,
} from '../../../references/operand-inputs.js';

/**
 * Resolves sweep cut obj against the current scope and reports unresolved references.
 */
export function resolveSweepCutObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'sweep_cut' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'sweep cut');
  resolvePathInput(op.path, scope, state, 'sweep cut');
  resolveThroughTarget(op.through, scope, state, 'sweep cut through');
  resolveDepthAndFrom(op, scope, state);
}
