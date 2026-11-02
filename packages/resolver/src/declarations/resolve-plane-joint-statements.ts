/**
 * @author Aidan Boissonneault
 * @file resolve-plane-joint-statements.ts
 * @purpose Resolves plane joint statements for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { JointDecl, PlaneDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFromRef } from '../references/refs.js';

/**
 * Resolves plane against the current scope and reports unresolved references.
 */
export function resolvePlane(
  stmt: PlaneDecl,
  scope: Scope,
  state: State,
): void {
  resolveExpr(stmt.offset, scope, state);
  resolveFromRef(stmt.from, scope, state, stmt.span, resolveExpr);
}

/**
 * Resolves joint against the current scope and reports unresolved references.
 */
export function resolveJoint(
  stmt: JointDecl,
  scope: Scope,
  state: State,
): void {
  /**
   * Resolves ref against the current scope and reports unresolved references.
   */
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
