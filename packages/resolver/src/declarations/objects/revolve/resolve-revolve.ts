import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveSketchInput } from '../../../references/operand-inputs.js';
import { resolveFaceRef } from '../../../references/refs.js';
import {
  namedSketchInputs,
  registerObjectProfileSegments,
} from '../profile-segments/profile-segments.js';

/**
 * Resolves revolve obj against the current scope and reports unresolved references.
 */
export function resolveRevolveObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'revolve' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'revolve');
  resolveExpr(op.angle, scope, state);
  if (typeof op.around !== 'string') {
    resolveFaceRef(
      op.around,
      scope,
      state,
      op.span,
      resolveExpr,
      'revolve-axis',
    );
  }
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs([op.sketch]),
    state,
  );
}
