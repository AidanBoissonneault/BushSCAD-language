import { resolveBooleanSketch } from './boolean/resolve-sketch-boolean.js';
import { resolveCircleSketch } from './circle/resolve-circle-sketch.js';
import { resolveEllipseSketch } from './ellipse/resolve-ellipse-sketch.js';
import { resolveInsetSketch } from './inset/resolve-inset-sketch.js';
import { resolvePathSketchPrimitive } from './path/resolve-path-sketch-primitive.js';
import { resolvePolygonSketch } from './polygon/resolve-polygon-sketch.js';
import { resolveRectSketch } from './rect/resolve-rect-sketch.js';
import { resolveRoundRectSketch } from './roundrect/resolve-roundrect-sketch.js';
import { resolveSketchAlias } from './sketch-alias/resolve-sketch-alias.js';
import { resolveSketchAt } from './sketch-at/resolve-sketch-at.js';
import { resolveSketchConstruction } from './sketch-construction/resolve-sketch-construction.js';
import { resolveSketchFillet } from './sketch-fillet/resolve-sketch-fillet.js';
import { resolveSketchOffset } from './sketch-offset/resolve-sketch-offset.js';
import { resolveSketchRef } from './sketch-ref/resolve-sketch-ref.js';
import { resolveSplineSketch } from './spline/resolve-spline-sketch.js';
import { resolveTriangleSketch } from './triangle/resolve-triangle-sketch.js';
import { resolveUnsupportedSketch } from './unsupported/resolve-unsupported-sketch.js';
import { resolveWordSketch } from './word/resolve-word-sketch.js';
import { resolveWrapSketch } from './wrap/resolve-wrap-sketch.js';
import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import type {
  NestedSketchResolver,
  SketchPrimitive,
  SketchPrimitiveResolver,
} from './types.js';

const SKETCH_PRIMITIVE_RESOLVERS: Record<
  SketchPrimitive['kind'],
  SketchPrimitiveResolver
> = {
  rect: resolveRectSketch,
  circle: resolveCircleSketch,
  ellipse: resolveEllipseSketch,
  splineSketch: resolveSplineSketch,
  roundrect: resolveRoundRectSketch,
  triangle: resolveTriangleSketch,
  polygon: resolvePolygonSketch,
  pathSketch: resolvePathSketchPrimitive,
  wrapSketch: resolveWrapSketch,
  word: resolveWordSketch,
  inset: resolveInsetSketch,
  sketchConstruction: resolveSketchConstruction,
  sketchOffset: resolveSketchOffset,
  sketchFillet: resolveSketchFillet,
  unsupportedSketch: resolveUnsupportedSketch,
  sketchRef: resolveSketchRef,
  sketchBoolean: resolveBooleanSketch,
  sketchAlias: resolveSketchAlias,
  sketchAt: resolveSketchAt,
};

/** Dispatches primitive references and expressions to the owning resolver. */
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
