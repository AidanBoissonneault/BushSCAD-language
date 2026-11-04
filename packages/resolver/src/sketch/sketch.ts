/**
 * @author Aidan Boissonneault
 * @file sketch.ts
 * @purpose Provides sketch behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFromRef } from '../references/refs.js';
import { resolveSketchPrimitive } from './primitives/resolve-sketch-primitive.js';
import { resolveCompactSketchDimensions } from './resolve-compact-sketch-dimensions.js';
import { sketchPrimitiveSegmentNames } from './sketch-segment-names.js';

/**
 * Resolves sketch primitives and records profile segment names for later face checks.
 */
export function resolveSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  resolveCompactSketchDimensions(stmt, scope, state);
  resolveSketchPrimitive(stmt, scope, state, (primitive) =>
    resolveSketch({ ...stmt, primitive }, scope, state),
  );
  registerSketchSegmentNames(stmt, state);
  resolveSketchPlacement(stmt, scope, state);
}

/**
 * Handles register sketch segment names in the sketch flow.
 */
function registerSketchSegmentNames(stmt: SketchDecl, state: State): void {
  const names = sketchPrimitiveSegmentNames(stmt.primitive);
  if (names.size > 0) state.profileSketchSegments.set(stmt.name, names);
}

/**
 * Resolves sketch placement against the current scope and reports unresolved references.
 */
function resolveSketchPlacement(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  if (!stmt.placement) return;
  resolveFromRef(
    stmt.placement.face,
    scope,
    state,
    stmt.span,
    resolveExpr,
    stmt.placement.mode === 'on' ? 'sketch-on-surface' : 'placement',
  );
  if (stmt.placement.angle) resolveExpr(stmt.placement.angle, scope, state);
}
