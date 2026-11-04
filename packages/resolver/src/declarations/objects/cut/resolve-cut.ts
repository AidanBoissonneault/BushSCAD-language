import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import {
  resolveSketchInput,
  resolveThroughTarget,
} from '../../../references/operand-inputs.js';
import { resolveDepthAndFrom } from '../shared/resolve-depth-and-from.js';
import { validateWrapTarget } from '../wrap/validate-wrap-target.js';

/**
 * Resolves cut obj against the current scope and reports unresolved references.
 */
export function resolveCutObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'cut' }>;
  resolveSketchInput(op.sketch, scope, state, 'cut', !op.wrap);
  resolveThroughTarget(op.through, scope, state, 'through-cut');
  resolveDepthAndFrom(op, scope, state);
  validateWrapTarget('cut', op.wrap, op.from ?? null, op.span, state);
}
