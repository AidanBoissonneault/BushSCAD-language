/** Resolves the target and optional face reference of mirror. */
import type { MirrorStmt } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFaceRef } from '../../references/refs.js';
import { requireTargetObject } from '../object-target-validation.js';

/** Resolves the mirror target and its optional face-based plane. */
export function resolveMirror(
  stmt: MirrorStmt,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'mirror');
  if (stmt.across.kind === 'faceRef') {
    resolveFaceRef(stmt.across.ref, scope, state, stmt.span, resolveExpr);
  }
}
