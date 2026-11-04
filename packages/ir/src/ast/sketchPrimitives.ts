/**
 * @author Aidan Boissonneault
 * @file sketchPrimitives.ts
 * @purpose Provides sketch primitives behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr } from './expressions.js';
import type {
  ConstraintDecl,
  SketchDimensionDecl,
} from './sketchAnnotations.js';
import type {
  PathBodyExpressionDecl,
  PathClosedBodyDecl,
  PathIgnoredBodyExpressionDecl,
  PathIgnoredClosedBodyDecl,
} from './pathBodyExpressions.js';
import type { SketchOriginOption } from './sketchPrimitiveOptions.js';
import type {
  CirclePrimitive,
  EllipsePrimitive,
  RectPrimitive,
  RoundRectPrimitive,
} from './sketchCompactPrimitives.js';

export type {
  RectSide,
  RectSideNames,
  SketchOrigin,
  SketchPlacement,
} from './sketchPrimitiveOptions.js';
export type {
  CirclePrimitive,
  EllipsePrimitive,
  RectPrimitive,
  RoundRectPrimitive,
} from './sketchCompactPrimitives.js';

/** Sketch primitive nodes that can create or derive 2D profile geometry. */
export type SketchPrimitive =
  | RectPrimitive
  | CirclePrimitive
  | RoundRectPrimitive
  | TrianglePrimitive
  | PolygonPrimitive
  | PathSketchPrimitive
  | WrapSketchPrimitive
  | WordPrimitive
  | EllipsePrimitive
  | SplineSketchPrimitive
  | InsetPrimitive
  | SketchConstructionPrimitive
  | SketchOffsetPrimitive
  | SketchFilletPrimitive
  | UnsupportedSketchPrimitive
  | SketchRefPrimitive
  | SketchBooleanPrimitive
  | SketchAliasPrimitive
  | SketchAtPrimitive;

/**
 * Derives `SplineSketchPrimitive` from `SketchOriginOption & { kind: 'splineSketch'; points: [Expr,
 * Expr][]; span: ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type SplineSketchPrimitive = SketchOriginOption & {
  kind: 'splineSketch';
  points: [Expr, Expr][];
  span: ASTSourceSpan;
};

/**
 * Derives `TrianglePrimitive` from `SketchOriginOption & { kind: 'triangle'; base: Expr; height: Expr;
 * span: ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type TrianglePrimitive = SketchOriginOption & {
  kind: 'triangle';
  base: Expr;
  height: Expr;
  span: ASTSourceSpan;
};

/**
 * Derives `PolygonPrimitive` from `SketchOriginOption & { kind: 'polygon'; points: [Expr, Expr][];
 * plant?: boolean; span: ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type PolygonPrimitive = SketchOriginOption & {
  kind: 'polygon';
  points: [Expr, Expr][];
  plant?: boolean;
  span: ASTSourceSpan;
};

/**
 * Derives `PathSketchPrimitive` from `SketchOriginOption & { kind: 'pathSketch'; placementOrigin?:
 * [Expr, Expr]; items: PathItem[]; closedBodies: PathClosedBodyDecl[]; ignoredClosedBodies:
 * PathIgnoredClosedBodyDecl[]; bodyExpressions: PathBodyExpressionDecl[]; ignoredBodyExpressions:
 * PathIgnoredBodyExpressionDecl[]; constraints: ConstraintDecl[]; dimensions: SketchDimensionDecl[];
 * span: ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type PathSketchPrimitive = SketchOriginOption & {
  kind: 'pathSketch';
  placementOrigin?: [Expr, Expr];
  items: PathItem[];
  closedBodies: PathClosedBodyDecl[];
  ignoredClosedBodies: PathIgnoredClosedBodyDecl[];
  bodyExpressions: PathBodyExpressionDecl[];
  ignoredBodyExpressions: PathIgnoredBodyExpressionDecl[];
  constraints: ConstraintDecl[];
  dimensions: SketchDimensionDecl[];
  span: ASTSourceSpan;
};

/** One cursor-driven line, arc, or close entry inside `path(...)`. */
export type PathSegmentItem = {
  kind: 'segment';
  name?: string;
  plant?: boolean;
  construction?: boolean;
  segment: PathSegment;
  span: ASTSourceSpan;
};

/** Compact closed primitives accepted alongside explicit path segments. */
export type PathEmbeddedPrimitive =
  RectPrimitive | CirclePrimitive | EllipsePrimitive | PathEmbeddedAtPrimitive;

/** Local translation around a compact primitive embedded in `path(...)`. */
export type PathEmbeddedAtPrimitive = {
  kind: 'sketchAt';
  primitive: PathEmbeddedPrimitive;
  x: Expr;
  y: Expr;
  span: ASTSourceSpan;
};

/** One compact primitive entry inside `path(...)`. */
export type PathPrimitiveItem = {
  kind: 'primitive';
  construction?: boolean;
  primitive: PathEmbeddedPrimitive;
  span: ASTSourceSpan;
};

/** Source-ordered geometry entries accepted by the mixed path container. */
export type PathItem = PathSegmentItem | PathPrimitiveItem;

/**
 * Path segment accepts PathLineSegment, PathArcSegment, and PathCloseSegment.
 */
export type PathSegment = PathLineSegment | PathArcSegment | PathCloseSegment;

/**
 * Path line segment, including operation kind, form, start, end, and span.
 */
export type PathLineSegment = {
  kind: 'line';
  form: 'explicit' | 'inferred';
  start?: [Expr, Expr];
  end: [Expr, Expr];
  span: ASTSourceSpan;
};

/**
 * Path arc segment, including operation kind, form, start, end, and radius.
 */
export type PathArcSegment = {
  kind: 'arc';
  form: 'explicit' | 'inferred';
  start?: [Expr, Expr];
  end: [Expr, Expr];
  /** Omitted radius creates the default semicircle between the endpoints. */
  radius?: Expr;
  direction: 'cw' | 'ccw';
  span: ASTSourceSpan;
};

/**
 * Path close segment, including operation kind and span.
 */
export type PathCloseSegment = {
  kind: 'close';
  span: ASTSourceSpan;
};

/**
 * Accepted values for wrap mode are 'ordered', 'convex', 'concave', and 'smooth'.
 */
export type WrapMode = 'ordered' | 'convex' | 'concave' | 'smooth';

/**
 * Derives `WrapSketchPrimitive` from `SketchOriginOption & { kind: 'wrapSketch'; points: Expr; mode:
 * WrapMode; options: { name: string; value: Expr }[]; span: ASTSourceSpan; }` to preserve its type
 * relationship in the ast layer.
 */
export type WrapSketchPrimitive = SketchOriginOption & {
  kind: 'wrapSketch';
  points: Expr;
  mode: WrapMode;
  options: { name: string; value: Expr }[];
  span: ASTSourceSpan;
};

/**
 * Derives `WordPrimitive` from `SketchOriginOption & { kind: 'word'; text: Expr; size: Expr; font?:
 * Expr; align?: 'center' | 'left' | 'right'; span: ASTSourceSpan; }` to preserve its type relationship
 * in the ast layer.
 */
export type WordPrimitive = SketchOriginOption & {
  kind: 'word';
  text: Expr;
  size: Expr;
  font?: Expr;
  align?: 'center' | 'left' | 'right';
  span: ASTSourceSpan;
};

/**
 * Derives `InsetPrimitive` from `SketchOriginOption & { kind: 'inset'; base: 'rect'; all?: Expr; x?:
 * Expr; y?: Expr; top?: Expr; bottom?: Expr; sides?: Expr; span: ASTSourceSpan; }` to preserve its
 * type relationship in the ast layer.
 */
export type InsetPrimitive = SketchOriginOption & {
  kind: 'inset';
  base: 'rect';
  all?: Expr;
  x?: Expr;
  y?: Expr;
  top?: Expr;
  bottom?: Expr;
  sides?: Expr;
  span: ASTSourceSpan;
};

/**
 * Primitive for sketch construction, including operation kind, primitive, and span.
 */
export type SketchConstructionPrimitive = {
  kind: 'sketchConstruction';
  primitive: SketchPrimitive;
  span: ASTSourceSpan;
};

/**
 * Primitive for sketch offset, including operation kind, primitive, distance, and span.
 */
export type SketchOffsetPrimitive = {
  kind: 'sketchOffset';
  primitive: SketchPrimitive;
  distance: Expr;
  span: ASTSourceSpan;
};

/**
 * Primitive for sketch fillet, including operation kind, primitive, radius, and span.
 */
export type SketchFilletPrimitive = {
  kind: 'sketchFillet';
  primitive: SketchPrimitive;
  radius: Expr;
  span: ASTSourceSpan;
};

/**
 * Primitive for unsupported sketch, including operation kind, operation, and span.
 */
export type UnsupportedSketchPrimitive = {
  kind: 'unsupportedSketch';
  operation: 'project' | 'trim' | 'extend';
  span: ASTSourceSpan;
};

/** Reference to an already-declared sketch usable inside sketch expressions. */
export type SketchRefPrimitive = {
  kind: 'sketchRef';
  name: string;
  span: ASTSourceSpan;
};

/**
 * Primitive for sketch boolean, including operation kind, op, left, right, and span.
 */
export type SketchBooleanPrimitive = {
  kind: 'sketchBoolean';
  op: 'add' | 'subtract';
  left: SketchPrimitive;
  right: SketchPrimitive;
  span: ASTSourceSpan;
};

/** Gives one nested sketch expression a stable selectable component path. */
export type SketchAliasPrimitive = {
  kind: 'sketchAlias';
  name: string;
  nameSpan: ASTSourceSpan;
  primitive: SketchPrimitive;
  span: ASTSourceSpan;
};

/**
 * Primitive for sketch at, including operation kind, primitive, x, y, and span.
 */
export type SketchAtPrimitive = {
  kind: 'sketchAt';
  primitive: SketchPrimitive;
  x: Expr;
  y: Expr;
  span: ASTSourceSpan;
};
