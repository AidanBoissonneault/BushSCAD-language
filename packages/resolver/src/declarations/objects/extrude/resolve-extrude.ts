import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveSketchInput } from '../../../references/operand-inputs.js';
import {
  resolveDepthAndFrom,
  resolveOptionalFrom,
} from '../shared/resolve-depth-and-from.js';
import { validateWrapTarget } from '../wrap/validate-wrap-target.js';
import {
  namedSketchInputs,
  registerObjectProfileSegments,
} from '../profile-segments/profile-segments.js';

/**
 * Resolves extrude obj against the current scope and reports unresolved references.
 */
export function resolveExtrudeObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'extrude' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'extrude', !op.wrap);
  resolveExpr(op.depth, scope, state);
  resolveOptionalFrom(op, scope, state);
  validateWrapTarget('extrude', op.wrap, op.from ?? null, op.span, state);
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs([op.sketch]),
    state,
  );
}
