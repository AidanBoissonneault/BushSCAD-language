/**
 * Resolves for-loop bindings, filters, placement bounds, and nested statements.
 */
import type { ForStatement } from '@bushscad/ir';
import { addError } from '../../core/errors.js';
import { Scope as ScopeClass } from '../../core/scope.js';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFaceRef } from '../../references/refs.js';
import { resolveForIterator } from '../for-iterator.js';
import type { BodyResolver } from '../body-resolver.js';
/**
 * Resolves for against the current scope and reports unresolved references.
 */
export function resolveFor(
  stmt: ForStatement,
  scope: Scope,
  state: State,
  resolveBody: BodyResolver,
): void {
  resolveForIterator(stmt, scope, state);
  const bodyScope = forBodyScope(stmt, scope);
  if (stmt.where) resolveExpr(stmt.where, bodyScope, state);
  if (stmt.within) resolveWithinClause(stmt, bodyScope, state);
  resolveForBody(stmt, bodyScope, state, resolveBody);
}

/**
 * Handles for body scope in the declarations flow.
 */
function forBodyScope(stmt: ForStatement, scope: Scope): Scope {
  const bodyScope = new ScopeClass(scope);
  const bindings = Array.isArray(stmt.binding) ? stmt.binding : [stmt.binding];
  for (const binding of bindings) bodyScope.define(binding, 'binding');
  return bodyScope;
}

/**
 * Resolves within clause against the current scope and reports unresolved references.
 */
function resolveWithinClause(
  stmt: ForStatement,
  bodyScope: Scope,
  state: State,
): void {
  const within = stmt.within;
  if (!within) return;

  for (const dim of within.dims) resolveWithinDim(dim, bodyScope, state);
  const expected = stmt.iterator.kind === 'grid' ? 2 : 1;
  if (within.dims.length !== expected) {
    addError(
      state,
      `'within' expects ${expected} dimension${expected > 1 ? 's' : ''} for a ${stmt.iterator.kind} loop, got ${within.dims.length}`,
      within.span,
    );
  }
}

/**
 * Resolves within dim against the current scope and reports unresolved references.
 */
function resolveWithinDim(
  dim: NonNullable<ForStatement['within']>['dims'][number],
  bodyScope: Scope,
  state: State,
): void {
  if (dim.kind === 'faceDim') {
    resolveFaceRef(
      dim.ref,
      bodyScope,
      state,
      dim.span,
      resolveExpr,
      'measurement',
    );
  } else {
    resolveExpr(dim.expr, bodyScope, state);
  }
}

/**
 * Resolves for body against the current scope and reports unresolved references.
 */
function resolveForBody(
  stmt: ForStatement,
  bodyScope: Scope,
  state: State,
  resolveBody: BodyResolver,
): void {
  const prevWithin = state.inWithinLoop;
  if (stmt.within) state.inWithinLoop = true;
  resolveBody(stmt.body, bodyScope, state, state.inComponent, false);
  state.inWithinLoop = prevWithin;
}
