import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import {
  resolvePathInput,
  resolveSketchInput,
} from '../../../references/operand-inputs.js';

/**
 * Resolves sweep obj against the current scope and reports unresolved references.
 */
export function resolveSweepObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'sweep' }>;
  resolveSketchInput(op.sketch, scope, state, 'sweep');
  resolvePathInput(op.path, scope, state, 'sweep');
}
