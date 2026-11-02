/**
 * @author Aidan Boissonneault
 * @file resolve-transform-statements.ts
 * @purpose Resolves transform statements for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { MirrorStmt, RotateStatement, TransformStmt } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFaceRef } from '../references/refs.js';
import { requireTargetObject } from './object-target-validation.js';

/**
 * Resolves rotate against the current scope and reports unresolved references.
 */
export function resolveRotate(
  stmt: RotateStatement,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'rotate');
  resolveExpr(stmt.angle, scope, state);
  if (typeof stmt.around !== 'string') {
    resolveFaceRef(
      stmt.around,
      scope,
      state,
      stmt.span,
      resolveExpr,
      'revolve-axis',
    );
  }
}

/**
 * Resolves mirror against the current scope and reports unresolved references.
 */
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

/**
 * Resolves transform against the current scope and reports unresolved references.
 */
export function resolveTransform(
  stmt: TransformStmt,
  scope: Scope,
  state: State,
): void {
  requireTargetObject(stmt.target, scope, state, stmt.span, 'transform');
  const op = stmt.operation;
  if (op.kind === 'translate') {
    if (op.x) resolveExpr(op.x, scope, state);
    if (op.y) resolveExpr(op.y, scope, state);
    if (op.z) resolveExpr(op.z, scope, state);
  } else if (op.kind === 'rotate') {
    resolveExpr(op.angle, scope, state);
    if (typeof op.around !== 'string') {
      resolveFaceRef(
        op.around,
        scope,
        state,
        stmt.span,
        resolveExpr,
        'revolve-axis',
      );
    }
  } else if (op.kind === 'scale') {
    resolveExpr(op.factor, scope, state);
  }
}
