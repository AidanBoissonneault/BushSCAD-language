/** Resolves the offset and reference source of a named plane. */
import type { PlaneDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFromRef } from '../../references/refs.js';

/** Resolves a plane offset and its source reference in the current scope. */
export function resolvePlane(
  stmt: PlaneDecl,
  scope: Scope,
  state: State,
): void {
  resolveExpr(stmt.offset, scope, state);
  resolveFromRef(stmt.from, scope, state, stmt.span, resolveExpr);
}
