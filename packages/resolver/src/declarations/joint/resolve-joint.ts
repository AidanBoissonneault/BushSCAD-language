/** Resolves the named objects and motion expressions of a joint. */
import type { JointDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';

/** Resolves both joint endpoints and validates its optional motion limits. */
export function resolveJoint(
  stmt: JointDecl,
  scope: Scope,
  state: State,
): void {
  const resolveRef = (ref: string, label: string): void => {
    const objName = ref.split('.')[0];
    if (scope.lookup(objName) === null && !state.globalParts.has(objName)) {
      addError(
        state,
        `Undefined object '${objName}' in joint ${label}`,
        stmt.span,
      );
    }
  };
  resolveRef(stmt.sideA, 'sideA');
  resolveRef(stmt.sideB, 'sideB');
  if (stmt.limitMin) resolveExpr(stmt.limitMin, scope, state);
  if (stmt.limitMax) resolveExpr(stmt.limitMax, scope, state);
  if (stmt.defaultValue) resolveExpr(stmt.defaultValue, scope, state);
  scope.define(stmt.name, 'joint');
}
