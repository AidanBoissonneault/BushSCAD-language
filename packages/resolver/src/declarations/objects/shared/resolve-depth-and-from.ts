/** Resolves shared object operation depth and placement inputs. */
import type { Expr, ObjDecl, RepeatableSpatialRef } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFromRef } from '../../../references/refs.js';

type OpSpan = ObjDecl['operation']['span'];

/**
 * Resolves optional from against the current scope and reports unresolved references.
 */
export function resolveOptionalFrom(
  op: { from?: RepeatableSpatialRef | null; span: OpSpan },
  scope: Scope,
  state: State,
): void {
  if (op.from) resolveFromRef(op.from, scope, state, op.span, resolveExpr);
}

/**
 * Resolves depth and from against the current scope and reports unresolved references.
 */
export function resolveDepthAndFrom(
  op: { depth?: Expr | null; from?: RepeatableSpatialRef | null; span: OpSpan },
  scope: Scope,
  state: State,
): void {
  if (op.depth) resolveExpr(op.depth, scope, state);
  resolveOptionalFrom(op, scope, state);
}
