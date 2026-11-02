/**
 * @author Aidan Boissonneault
 * @file surface.ts
 * @purpose Provides surface behavior for the geometry in resolver package.
 * @last-edited October 6, 2026
 */

import type { SurfaceDecl, SurfaceInput, SurfaceOperation } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveRepeatableFaceRef } from '../references/refs.js';

/**
 * Resolves a surface declaration and validates surface-only references.
 * Open surfaces are not solids. They need a separate symbol path so later
 * operations can reject them where a closed object is required.
 */
export function resolveSurface(
  stmt: SurfaceDecl,
  scope: Scope,
  state: State,
): void {
  resolveSurfaceDeclOperation(stmt.operation, scope, state);
}

/** Resolves one surface-producing operation, including nested surface inputs. */
function resolveSurfaceDeclOperation(
  operation: SurfaceOperation,
  scope: Scope,
  state: State,
): void {
  if (operation.kind === 'fill') {
    resolveRepeatableFaceRef(
      operation.boundary,
      scope,
      state,
      operation.span,
      resolveExpr,
      'fill',
    );
    return;
  }

  resolveSurfaceInput(operation.surface, scope, state, 'offset_surface');
  resolveExpr(operation.distance, scope, state);
}

/**
 * Resolves surface input against the current scope and reports unresolved references.
 */
export function resolveSurfaceInput(
  input: SurfaceInput,
  scope: Scope,
  state: State,
  context: string,
): void {
  if (input.kind === 'namedSurface') {
    requireSurface(input.name, scope, state, input.span, context);
    return;
  }
  resolveSurfaceDeclOperation(input.operation, scope, state);
}

/**
 * Handles require surface in the geometry flow.
 */
function requireSurface(
  name: string,
  scope: Scope,
  state: State,
  span: SurfaceDecl['span'],
  context: string,
): void {
  if (scope.lookup(name) !== 'surface') {
    addError(state, `Undefined surface '${name}' in ${context}`, span);
  }
}

/**
 * Handles reject surface as solid in the geometry flow.
 */
export function rejectSurfaceAsSolid(
  name: string,
  scope: Scope,
  state: State,
  span: SurfaceDecl['span'],
  context: string,
): boolean {
  if (scope.lookup(name) !== 'surface') return false;
  addError(
    state,
    `Open surface '${name}' cannot be used as a solid object in ${context}`,
    span,
  );
  return true;
}
