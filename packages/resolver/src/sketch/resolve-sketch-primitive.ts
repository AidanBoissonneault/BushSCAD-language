/**
 * @author Aidan Boissonneault
 * @file resolve-sketch-primitive.ts
 * @purpose Resolves sketch primitive for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolvePathSketch } from './resolve-path-sketch.js';
import { inheritSketchSegmentNames } from './sketch-reference-segments.js';
import { validateBooleanComponentAliases } from './sketch-component-aliases.js';

/**
 * Derives `SketchPrimitive` from `SketchDecl['primitive']` to preserve its type relationship in the
 * sketch layer.
 */
type SketchPrimitive = SketchDecl['primitive'];
/**
 * Derives `SketchPrimitiveKind` from `SketchPrimitive['kind']` to preserve its type relationship in
 * the sketch layer.
 */
type SketchPrimitiveKind = SketchPrimitive['kind'];
/**
 * Defines the `NestedSketchResolver` callback contract used by the sketch layer.
 */
type NestedSketchResolver = (primitive: SketchPrimitive) => void;
/**
 * Defines the `SketchPrimitiveResolver` callback contract used by the sketch layer.
 */
type SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
) => void;

const SKETCH_PRIMITIVE_RESOLVERS: Record<
  SketchPrimitiveKind,
  SketchPrimitiveResolver
> = {
  rect: resolveRectSketch,
  circle: resolveCircleSketch,
  ellipse: resolveEllipseSketch,
  splineSketch: resolvePointListSketch,
  roundrect: resolveRoundRectSketch,
  triangle: resolveTriangleSketch,
  polygon: resolvePointListSketch,
  pathSketch: resolvePathSketchPrimitive,
  wrapSketch: resolveWrapSketch,
  word: resolveWordSketch,
  inset: resolveInsetSketch,
  sketchConstruction: resolveUnaryNestedSketch,
  sketchOffset: resolveOffsetSketch,
  sketchFillet: resolveFilletSketch,
  unsupportedSketch: () => {},
  sketchRef: resolveSketchRef,
  sketchBoolean: resolveBooleanSketch,
  sketchAlias: resolveUnaryNestedSketch,
  sketchAt: resolveSketchAt,
};

/**
 * Resolves expressions and references inside a sketch primitive by primitive
 * kind while leaving declaration placement handling to the caller.
 */
export function resolveSketchPrimitive(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
): void {
  SKETCH_PRIMITIVE_RESOLVERS[stmt.primitive.kind](
    stmt,
    scope,
    state,
    resolveNested,
  );
}

/**
 * Resolves rectangle dimension expressions while leaving side aliases literal.
 * Side aliases name generated edges and must not be looked up as variables.
 */
function resolveRectSketch(stmt: SketchDecl, scope: Scope, state: State): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'rect' }
  >;
  resolveExpr(primitive.width, scope, state);
  resolveExpr(primitive.height, scope, state);
  if (primitive.cornerRadius) resolveExpr(primitive.cornerRadius, scope, state);
}

/**
 * Resolves circle sketch against the current scope and reports unresolved references.
 */
function resolveCircleSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'circle' }
  >;
  resolveExpr(primitive.diameter, scope, state);
}

/**
 * Resolves ellipse sketch against the current scope and reports unresolved references.
 */
function resolveEllipseSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'ellipse' }
  >;
  resolveExpr(primitive.width, scope, state);
  resolveExpr(primitive.height, scope, state);
}

/**
 * Resolves point list sketch against the current scope and reports unresolved references.
 */
function resolvePointListSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'splineSketch' | 'polygon' }
  >;
  for (const [x, y] of primitive.points) {
    resolveExpr(x, scope, state);
    resolveExpr(y, scope, state);
  }
}

/**
 * Resolves round rect sketch against the current scope and reports unresolved references.
 */
function resolveRoundRectSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'roundrect' }
  >;
  resolveExpr(primitive.width, scope, state);
  resolveExpr(primitive.height, scope, state);
  resolveExpr(primitive.radius, scope, state);
}

/**
 * Resolves triangle sketch against the current scope and reports unresolved references.
 */
function resolveTriangleSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'triangle' }
  >;
  resolveExpr(primitive.base, scope, state);
  resolveExpr(primitive.height, scope, state);
}

/**
 * Resolves path sketch primitive against the current scope and reports unresolved references.
 */
function resolvePathSketchPrimitive(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'pathSketch' }
  >;
  resolvePathSketch(primitive, stmt.name, scope, state);
}

/**
 * Resolves wrap sketch against the current scope and reports unresolved references.
 */
function resolveWrapSketch(stmt: SketchDecl, scope: Scope, state: State): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'wrapSketch' }
  >;
  resolveExpr(primitive.points, scope, state);
  for (const option of primitive.options)
    resolveExpr(option.value, scope, state);
}

/**
 * Resolves word sketch against the current scope and reports unresolved references.
 */
function resolveWordSketch(stmt: SketchDecl, scope: Scope, state: State): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'word' }
  >;
  resolveExpr(primitive.text, scope, state);
  resolveExpr(primitive.size, scope, state);
  if (primitive.font) resolveExpr(primitive.font, scope, state);
}

/**
 * Resolves inset sketch against the current scope and reports unresolved references.
 */
function resolveInsetSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'inset' }
  >;
  if (primitive.all) resolveExpr(primitive.all, scope, state);
  if (primitive.x) resolveExpr(primitive.x, scope, state);
  if (primitive.y) resolveExpr(primitive.y, scope, state);
  if (primitive.top) resolveExpr(primitive.top, scope, state);
  if (primitive.bottom) resolveExpr(primitive.bottom, scope, state);
  if (primitive.sides) resolveExpr(primitive.sides, scope, state);
}

/**
 * Resolves unary nested sketch against the current scope and reports unresolved references.
 */
function resolveUnaryNestedSketch(
  stmt: SketchDecl,
  _scope: Scope,
  _state: State,
  resolveNested: NestedSketchResolver,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchConstruction' | 'sketchAlias' }
  >;
  resolveNested(primitive.primitive);
}

/**
 * Resolves offset sketch against the current scope and reports unresolved references.
 */
function resolveOffsetSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchOffset' }
  >;
  resolveNested(primitive.primitive);
  resolveExpr(primitive.distance, scope, state);
}

/**
 * Resolves fillet sketch against the current scope and reports unresolved references.
 */
function resolveFilletSketch(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchFillet' }
  >;
  resolveNested(primitive.primitive);
  resolveExpr(primitive.radius, scope, state);
}

/**
 * Resolves sketch ref against the current scope and reports unresolved references.
 */
function resolveSketchRef(stmt: SketchDecl, scope: Scope, state: State): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchRef' }
  >;
  if (scope.lookup(primitive.name) !== 'sketch') {
    addError(
      state,
      `Undefined sketch '${primitive.name}' in sketch expression`,
      primitive.span,
    );
    return;
  }
  inheritSketchSegmentNames(stmt.name, primitive.name, state);
}

/**
 * Resolves boolean sketch against the current scope and reports unresolved references.
 */
function resolveBooleanSketch(
  stmt: SketchDecl,
  _scope: Scope,
  _state: State,
  resolveNested: NestedSketchResolver,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchBoolean' }
  >;
  validateBooleanComponentAliases(primitive, _state);
  resolveNested(primitive.left);
  resolveNested(primitive.right);
}

/**
 * Resolves sketch at against the current scope and reports unresolved references.
 */
function resolveSketchAt(
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
): void {
  const primitive = stmt.primitive as Extract<
    SketchPrimitive,
    { kind: 'sketchAt' }
  >;
  resolveNested(primitive.primitive);
  resolveExpr(primitive.x, scope, state);
  resolveExpr(primitive.y, scope, state);
}
