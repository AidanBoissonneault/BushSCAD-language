/**
 * @author Aidan Boissonneault
 * @file detail-selector-resolvers.ts
 * @purpose Provides detail selector resolvers behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ComponentStatement, FilletDetail } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveRepeatableFaceRef } from '../references/refs.js';

/** Resolves a fillet's repeatable edge selection and radius expression. */
export function resolveFilletDetail(
  stmt: FilletDetail,
  scope: Scope,
  state: State,
): void {
  resolveRepeatableFaceRef(
    stmt.target,
    scope,
    state,
    stmt.span,
    resolveExpr,
    'fillet',
  );
  resolveExpr(stmt.radius, scope, state);
}

/** Resolves a chamfer's repeatable edge/vertex selection and offset. */
export function resolveChamferDetail(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const chamfer = stmt as Extract<ComponentStatement, { kind: 'chamfer' }>;
  resolveRepeatableFaceRef(
    chamfer.target,
    scope,
    state,
    chamfer.span,
    resolveExpr,
    'chamfer',
  );
  resolveExpr(chamfer.offset, scope, state);
}

/** Resolves a draft's repeatable face selection and angle expression. */
export function resolveDraftDetail(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const draft = stmt as Extract<ComponentStatement, { kind: 'draft' }>;
  resolveRepeatableFaceRef(
    draft.target,
    scope,
    state,
    draft.span,
    resolveExpr,
    'draft',
  );
  resolveExpr(draft.angle, scope, state);
}
