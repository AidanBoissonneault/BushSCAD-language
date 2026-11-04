/** Resolves a chamfer edge selection and offset expression. */
import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveRepeatableFaceRef } from '../../references/refs.js';

/** Resolves the repeatable edge/vertex selector and offset of a chamfer. */
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
