/** Resolves the thread statement behavior in the declarations layer. */

import type { ComponentStatement } from '@bushscad/ir';
import type { Statement } from '../shared-statements.js';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { requireTargetObject } from '../object-target-validation.js';

/**
 * Resolves thread against the current scope and reports unresolved references.
 */
export function resolveThread(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const thread = stmt as Extract<Statement, { kind: 'thread' }>;
  requireTargetObject(thread.target, scope, state, thread.span, 'thread');
  resolveExpr(thread.diameter, scope, state);
  resolveExpr(thread.pitch, scope, state);
  if (thread.length) resolveExpr(thread.length, scope, state);
  if (thread.angle) resolveExpr(thread.angle, scope, state);
}
