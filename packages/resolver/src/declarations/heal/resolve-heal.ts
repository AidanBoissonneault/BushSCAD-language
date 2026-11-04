/** Resolves the heal statement behavior in the declarations layer. */

import type { HealDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';

/** Resolves a `heal` declaration: validates its target and tolerance. */
export function resolveHeal(stmt: HealDecl, scope: Scope, state: State): void {
  if (stmt.target && scope.lookup(stmt.target) === null) {
    addError(state, `Undefined shape '${stmt.target}' in heal`, stmt.span);
  }
  resolveExpr(stmt.tolerance, scope, state);
}
