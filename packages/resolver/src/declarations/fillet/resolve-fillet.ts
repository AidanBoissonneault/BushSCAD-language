/** Resolves a fillet edge selection and radius expression. */
import type { FilletDetail } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveRepeatableFaceRef } from '../../references/refs.js';

/** Resolves the repeatable edge selector and radius expression of a fillet. */
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
