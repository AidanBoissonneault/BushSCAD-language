/**
 * @author Aidan Boissonneault
 * @file resolve-place-statement.ts
 * @purpose Resolves place statement for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { PlaceStatement } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFromRef } from '../references/refs.js';

/**
 * Resolves place against the current scope and reports unresolved references.
 */
export function resolvePlace(
  stmt: PlaceStatement,
  scope: Scope,
  state: State,
): void {
  validatePlaceSource(stmt, scope, state);
  resolvePlaceArgs(stmt, scope, state);
  resolvePlaceRefs(stmt, scope, state);
  if (stmt.rotate) resolvePlacementRotation(stmt.rotate, scope, state);
  if (stmt.as) scope.define(stmt.as, 'obj');
}

/**
 * Validates place source and reports any violations.
 */
export function validatePlaceSource(
  stmt: PlaceStatement,
  scope: Scope,
  state: State,
): void {
  const sourceKind = scope.lookup(stmt.component);
  if (
    sourceKind === null ||
    !['component', 'part', 'fn', 'obj', 'shape'].includes(sourceKind)
  ) {
    addError(
      state,
      `Undefined placeable '${stmt.component}' in place`,
      stmt.span,
    );
  }
}

/**
 * Resolves place args against the current scope and reports unresolved references.
 */
export function resolvePlaceArgs(
  stmt: PlaceStatement,
  scope: Scope,
  state: State,
): void {
  for (const arg of stmt.args) resolveExpr(arg, scope, state);
  for (const { value } of stmt.namedArgs) resolveExpr(value, scope, state);
}

/**
 * Resolves place refs against the current scope and reports unresolved references.
 */
export function resolvePlaceRefs(
  stmt: PlaceStatement,
  scope: Scope,
  state: State,
): void {
  if (stmt.target)
    resolveFromRef(stmt.target, scope, state, stmt.span, resolveExpr);
  if (stmt.sourceAnchor && !isStandaloneSourceAnchor(stmt.sourceAnchor)) {
    resolveFromRef(stmt.sourceAnchor, scope, state, stmt.span, resolveExpr);
  }
}

/**
 * Returns whether the input meets the `standalone source anchor` condition.
 */
export function isStandaloneSourceAnchor(
  ref: PlaceStatement['sourceAnchor'],
): boolean {
  return ref?.kind === 'faceRef' && ref.chain.length === 1;
}

/**
 * Resolves placement rotation against the current scope and reports unresolved references.
 */
export function resolvePlacementRotation(
  rotate: NonNullable<PlaceStatement['rotate']>,
  scope: Scope,
  state: State,
): void {
  if (rotate.kind === 'default') {
    resolveExpr(rotate.angle, scope, state);
    return;
  }
  if (rotate.x) resolveExpr(rotate.x, scope, state);
  if (rotate.y) resolveExpr(rotate.y, scope, state);
  if (rotate.z) resolveExpr(rotate.z, scope, state);
}
