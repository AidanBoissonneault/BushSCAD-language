/**
 * @author Aidan Boissonneault
 * @file for-iterator.ts
 * @purpose Provides for iterator behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ForStatement } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';

/**
 * Resolves expressions used by a for-loop iterator.
 *
 * Iterator expressions are resolved in the parent scope because loop bindings
 * are introduced only for `where`, `within`, and the loop body.
 */
export function resolveForIterator(
  stmt: ForStatement,
  scope: Scope,
  state: State,
): void {
  const iter = stmt.iterator;
  if (iter.kind === 'range') {
    resolveRangeIterator(iter, scope, state);
  } else if (iter.kind === 'grid') {
    resolveGridIterator(iter, scope, state);
  } else if (iter.kind === 'radial') {
    resolveRadialIterator(iter, scope, state);
  } else {
    resolveExpr(iter.expr, scope, state);
  }
}

/**
 * Resolves range iterator against the current scope and reports unresolved references.
 */
function resolveRangeIterator(
  iter: Extract<ForStatement['iterator'], { kind: 'range' }>,
  scope: Scope,
  state: State,
): void {
  if (iter.start) resolveExpr(iter.start, scope, state);
  resolveExpr(iter.end, scope, state);
  if (iter.step) resolveExpr(iter.step, scope, state);
}

/**
 * Resolves grid iterator against the current scope and reports unresolved references.
 */
function resolveGridIterator(
  iter: Extract<ForStatement['iterator'], { kind: 'grid' }>,
  scope: Scope,
  state: State,
): void {
  resolveExpr(iter.cols, scope, state);
  resolveExpr(iter.rows, scope, state);
  if (iter.spacing) resolveExpr(iter.spacing, scope, state);
  if (iter.spacingX) resolveExpr(iter.spacingX, scope, state);
  if (iter.spacingY) resolveExpr(iter.spacingY, scope, state);
}

/**
 * Resolves radial iterator against the current scope and reports unresolved references.
 */
function resolveRadialIterator(
  iter: Extract<ForStatement['iterator'], { kind: 'radial' }>,
  scope: Scope,
  state: State,
): void {
  resolveExpr(iter.count, scope, state);
  if (iter.start) resolveExpr(iter.start, scope, state);
  if (iter.sweep) resolveExpr(iter.sweep, scope, state);
}
