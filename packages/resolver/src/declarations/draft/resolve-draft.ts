/** Resolves a draft face selection and angle expression. */
import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveRepeatableFaceRef } from '../../references/refs.js';

/** Resolves the repeatable face selector and angle expression of a draft. */
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
