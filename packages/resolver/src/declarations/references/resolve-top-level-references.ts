/** Owns references declaration resolution behavior. */
import { resolveBody } from '../body/resolve-body.js';
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { Scope as ScopeClass } from '../../core/scope.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveObj } from '../objects.js';
import { resolveFromRef } from '../../references/refs.js';
import { recordSelectorAlias } from '../../references/selector-aliases.js';

/**
 * Resolves top anchor against the current scope and reports unresolved references.
 */
export function resolveTopAnchor(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const anchor = stmt as Extract<TopLevelStatement, { kind: 'anchor' }>;
  resolveFromRef(anchor.point, scope, state, anchor.span, resolveExpr);
  recordSelectorAlias(anchor.name, anchor.point, scope, state);
}

/**
 * Resolves top ref part against the current scope and reports unresolved references.
 */
export function resolveTopRefPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const refPart = stmt as Extract<TopLevelStatement, { kind: 'refPart' }>;
  resolveBody(refPart.body, new ScopeClass(scope), state, true, true);
}

/**
 * Resolves top ref obj against the current scope and reports unresolved references.
 */
export function resolveTopRefObj(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const refObj = stmt as Extract<TopLevelStatement, { kind: 'refObj' }>;
  resolveObj(
    {
      kind: 'obj',
      name: refObj.name,
      operation: refObj.operation,
      anchors: [],
      span: refObj.span,
    },
    scope,
    state,
  );
}
