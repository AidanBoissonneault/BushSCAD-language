/** Resolves the shell statement behavior in the declarations layer. */

import type { ComponentStatement } from '@bushscad/ir';
import type { Statement } from '../shared-statements.js';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { requireTargetObject } from '../object-target-validation.js';

/**
 * Resolves shell against the current scope and reports unresolved references.
 */
export function resolveShell(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const shell = stmt as Extract<Statement, { kind: 'shell' }>;
  requireTargetObject(shell.target, scope, state, shell.span, 'shell');
  resolveExpr(shell.thickness, scope, state);
}
