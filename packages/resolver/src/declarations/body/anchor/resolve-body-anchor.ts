import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFromRef } from '../../../references/refs.js';
import { recordSelectorAlias } from '../../../references/selector-aliases.js';

/**
 * Resolves body anchor against the current scope and reports unresolved references.
 */
export function resolveBodyAnchor(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const anchor = stmt as Extract<ComponentStatement, { kind: 'anchor' }>;
  resolveFromRef(anchor.point, scope, state, anchor.span, resolveExpr);
  recordSelectorAlias(anchor.name, anchor.point, scope, state);
  scope.define(anchor.name, 'anchor');
}
