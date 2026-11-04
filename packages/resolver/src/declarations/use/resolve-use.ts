/** Resolves the use statement behavior in the declarations layer. */

import type { Statement } from '../shared-statements.js';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { isKnownBuiltinLibrary } from '../resolve-path-declaration.js';

/**
 * Resolves use against the current scope and reports unresolved references.
 */
export function resolveUse(stmt: Statement, _scope: Scope, state: State): void {
  const use = stmt as Extract<Statement, { kind: 'use' }>;
  if (!isKnownBuiltinLibrary(use.library)) {
    addError(state, `Unknown built-in library '${use.library}'`, use.span);
  }
}
