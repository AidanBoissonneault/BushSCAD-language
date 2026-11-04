/** Resolves the defeature statement behavior in the declarations layer. */

import type { DefeatureDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';

/** Resolves a `defeature` declaration: validates its target and threshold. */
export function resolveDefeature(
  stmt: DefeatureDecl,
  scope: Scope,
  state: State,
): void {
  if (stmt.target && scope.lookup(stmt.target) === null) {
    addError(state, `Undefined shape '${stmt.target}' in defeature`, stmt.span);
  }
  resolveExpr(stmt.threshold, scope, state);
}
