import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { addError } from '../../../core/errors.js';

/**
 * Resolves invalid return against the current scope and reports unresolved references.
 */
export function resolveInvalidReturn(
  stmt: ComponentStatement,
  _scope: Scope,
  state: State,
): void {
  addError(state, `'return' is only valid inside a function body`, stmt.span);
}
