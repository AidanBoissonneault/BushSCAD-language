/**
 * @author Aidan Boissonneault
 * @file eval-sketch-this.ts
 * @purpose Evaluates sketch this for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  Expr,
  SketchDimensionDecl,
  SketchPrimitive,
} from '@bushscad/ir';

/**
 * Derives `ExprKind` from `Expr['kind']` to preserve its type relationship in the sketch layer.
 */
type ExprKind = Expr['kind'];
/**
 * Derives `PrimitiveKind` from `SketchPrimitive['kind']` to preserve its type relationship in the
 * sketch layer.
 */
type PrimitiveKind = SketchPrimitive['kind'];

const EXPR_HANDLERS: Partial<Record<ExprKind, (expr: Expr) => boolean>> = {
  this: () => true,
  binary: (expr) =>
    expr.kind === 'binary' &&
    (exprUsesThis(expr.left) || exprUsesThis(expr.right)),
  unary: (expr) => expr.kind === 'unary' && exprUsesThis(expr.operand),
  ternary: (expr) =>
    expr.kind === 'ternary' &&
    (exprUsesThis(expr.condition) ||
      exprUsesThis(expr.then) ||
      exprUsesThis(expr.else)),
  list: (expr) => expr.kind === 'list' && expr.items.some(exprUsesThis),
  template: (expr) =>
    expr.kind === 'template' &&
    expr.parts.some(
      (part) => part.kind === 'expression' && exprUsesThis(part.expression),
    ),
  tuple: (expr) =>
    expr.kind === 'tuple' && (exprUsesThis(expr.x) || exprUsesThis(expr.y)),
  unit: (expr) => expr.kind === 'unit' && exprUsesThis(expr.value),
  call: (expr) =>
    expr.kind === 'call' &&
    (expr.args.some(exprUsesThis) ||
      expr.namedArgs.some((arg) => exprUsesThis(arg.value))),
};

/**
 * Handles expr uses this in the sketch flow.
 */
export function exprUsesThis(expr: Expr): boolean {
  return EXPR_HANDLERS[expr.kind]?.(expr) ?? false;
}

/**
 * Detects whether a sketch primitive depends on the active `this` context.
 * Component placement has to know whether a body must be evaluated with parent
 * face metrics. Sketch composition nests primitives, so this check is recursive.
 */
export function primitiveUsesThis(prim: SketchPrimitive): boolean {
  return PRIMITIVE_HANDLERS[prim.kind](prim);
}

const PRIMITIVE_HANDLERS: Record<
  PrimitiveKind,
  (prim: SketchPrimitive) => boolean
> = {
  rect: (prim) =>
    prim.kind === 'rect' &&
    (exprUsesThis(prim.width) ||
      exprUsesThis(prim.height) ||
      (prim.cornerRadius ? exprUsesThis(prim.cornerRadius) : false)),
  circle: (prim) => prim.kind === 'circle' && exprUsesThis(prim.diameter),
  ellipse: (prim) =>
    prim.kind === 'ellipse' &&
    (exprUsesThis(prim.width) || exprUsesThis(prim.height)),
  splineSketch: (prim) =>
    prim.kind === 'splineSketch' &&
    prim.points.some(([x, y]) => exprUsesThis(x) || exprUsesThis(y)),
  roundrect: (prim) =>
    prim.kind === 'roundrect' &&
    (exprUsesThis(prim.width) ||
      exprUsesThis(prim.height) ||
      exprUsesThis(prim.radius)),
  triangle: (prim) =>
    prim.kind === 'triangle' &&
    (exprUsesThis(prim.base) || exprUsesThis(prim.height)),
  polygon: (prim) =>
    prim.kind === 'polygon' &&
    prim.points.some(([x, y]) => exprUsesThis(x) || exprUsesThis(y)),
  pathSketch: (prim) =>
    prim.kind === 'pathSketch' &&
    (prim.items.some(pathItemUsesThis) ||
      prim.constraints.some(constraintUsesThis) ||
      prim.dimensions.some(dimensionUsesThis)),
  wrapSketch: (prim) =>
    prim.kind === 'wrapSketch' &&
    (exprUsesThis(prim.points) ||
      prim.options.some((option) => exprUsesThis(option.value))),
  word: (prim) =>
    prim.kind === 'word' &&
    (exprUsesThis(prim.text) ||
      exprUsesThis(prim.size) ||
      (prim.font ? exprUsesThis(prim.font) : false)),
  inset: () => false,
  sketchConstruction: (prim) =>
    prim.kind === 'sketchConstruction' && primitiveUsesThis(prim.primitive),
  sketchOffset: (prim) =>
    prim.kind === 'sketchOffset' &&
    (primitiveUsesThis(prim.primitive) || exprUsesThis(prim.distance)),
  sketchFillet: (prim) =>
    prim.kind === 'sketchFillet' &&
    (primitiveUsesThis(prim.primitive) || exprUsesThis(prim.radius)),
  unsupportedSketch: () => false,
  sketchBoolean: (prim) =>
    prim.kind === 'sketchBoolean' &&
    (primitiveUsesThis(prim.left) || primitiveUsesThis(prim.right)),
  sketchAlias: (prim) =>
    prim.kind === 'sketchAlias' && primitiveUsesThis(prim.primitive),
  sketchAt: (prim) =>
    prim.kind === 'sketchAt' &&
    (primitiveUsesThis(prim.primitive) ||
      exprUsesThis(prim.x) ||
      exprUsesThis(prim.y)),
  sketchRef: () => false,
};

/**
 * Builds the path data required by the current operation.
 */
function pathItemUsesThis(
  item: Extract<SketchPrimitive, { kind: 'pathSketch' }>['items'][number],
): boolean {
  if (item.kind === 'primitive') return primitiveUsesThis(item.primitive);
  return PATH_SEGMENT_USES_THIS[item.segment.kind](item.segment);
}

/**
 * Derives `PathSegment` from `Extract< Extract<SketchPrimitive, { kind: 'pathSketch'
 * }>['items'][number], { kind: 'segment' } >['segment']` to preserve its type relationship in the
 * sketch layer.
 */
type PathSegment = Extract<
  Extract<SketchPrimitive, { kind: 'pathSketch' }>['items'][number],
  { kind: 'segment' }
>['segment'];

const PATH_SEGMENT_USES_THIS: Record<
  PathSegment['kind'],
  (segment: PathSegment) => boolean
> = {
  close: () => false,
  arc: (segment) =>
    segment.kind === 'arc' &&
    ((segment.start?.some(exprUsesThis) ?? false) ||
      segment.end.some(exprUsesThis) ||
      exprUsesThis(segment.radius)),
  line: (segment) =>
    segment.kind === 'line' &&
    ((segment.start?.some(exprUsesThis) ?? false) ||
      segment.end.some(exprUsesThis)),
};

/**
 * Handles constraint uses this in the sketch flow.
 */
function constraintUsesThis(constraint: ConstraintDecl): boolean {
  return (
    (constraint.value ? exprUsesThis(constraint.value) : false) ||
    (constraint.label?.some(exprUsesThis) ?? false)
  );
}

/**
 * Builds the dimension data required by the current drawing.
 */
function dimensionUsesThis(dimension: SketchDimensionDecl): boolean {
  return dimension.label.some(exprUsesThis);
}
