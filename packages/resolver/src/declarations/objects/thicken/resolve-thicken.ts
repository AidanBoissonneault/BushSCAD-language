import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveSurfaceInput } from '../../../references/operand-inputs.js';

/**
 * Resolves thicken obj against the current scope and reports unresolved references.
 */
export function resolveThickenObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'thicken' }
  >;
  resolveSurfaceInput(op.surface, scope, state, 'thicken');
  resolveExpr(op.thickness, scope, state);
}
