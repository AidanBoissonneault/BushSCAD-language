/**
 * @author Aidan Boissonneault
 * @file eval-sketch-advanced.ts
 * @purpose Evaluates sketch advanced for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import type { EvalCtx } from '../core/eval-types.js';
import { evalEllipseSketch } from './eval-ellipse-sketch.js';

/**
 * Defines the `PrimitiveEvaluator` callback contract used by the sketch layer.
 */
type PrimitiveEvaluator = (
  primitive: SketchPrimitive,
  ctx: EvalCtx,
) => IRPrimitive | null;

/**
 * Result of advanced sketch accepts { handled: true; primitive: IRPrimitive | null } and {
 * handled: false }.
 */
type AdvancedSketchResult =
  | { handled: true; primitive: IRPrimitive | null }
  | { handled: false };

/**
 * Evaluates advanced sketch primitive with the current evaluation context.
 */
export function evalAdvancedSketchPrimitive(
  prim: SketchPrimitive,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): AdvancedSketchResult {
  switch (prim.kind) {
    case 'ellipse':
      return {
        handled: true,
        primitive: evalEllipseSketch(prim, ctx),
      };
    case 'splineSketch':
      return {
        handled: true,
        primitive: evalSplineSketch(prim.points, prim.span, ctx),
      };
    case 'sketchConstruction':
      return {
        handled: true,
        primitive: evalConstructionSketch(prim.primitive, ctx, evalPrimitive),
      };
    case 'sketchOffset':
      return {
        handled: true,
        primitive: evalSketchOffset(
          prim.primitive,
          prim.distance,
          prim.span,
          ctx,
          evalPrimitive,
        ),
      };
    case 'sketchFillet':
      return {
        handled: true,
        primitive: evalSketchFillet(
          prim.primitive,
          prim.radius,
          prim.span,
          ctx,
          evalPrimitive,
        ),
      };
    case 'unsupportedSketch':
      return {
        handled: true,
        primitive: evalUnsupportedSketchOperation(
          prim.operation,
          prim.span,
          ctx,
        ),
      };
    default:
      return { handled: false };
  }
}

/**
 * Evaluates sketch-level construction wrappers.
 * Construction geometry must remain visible to preview/constraints while being
 * excluded from profile wires that create solid faces.
 */
function evalConstructionSketch(
  primitive: SketchPrimitive,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const evaluated = evalPrimitive(primitive, ctx);
  return evaluated ? markConstruction(evaluated) : null;
}

/**
 * Evaluates sketch offset with the current evaluation context.
 */
function evalSketchOffset(
  primitive: SketchPrimitive,
  distanceExpr: import('@bushscad/ir').Expr,
  span: import('@bushscad/ir').ASTSourceSpan,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const distance = evalNum(distanceExpr, ctx);
  const evaluated = evalPrimitive(primitive, ctx);
  if (!evaluated) return null;
  if (evaluated.kind === 'rect') {
    return {
      ...evaluated,
      width: evaluated.width + distance * 2,
      height: evaluated.height + distance * 2,
    };
  }
  if (evaluated.kind === 'circle') {
    return { kind: 'circle', diameter: evaluated.diameter + distance * 2 };
  }
  if (evaluated.kind === 'roundrect') {
    return {
      ...evaluated,
      width: evaluated.width + distance * 2,
      height: evaluated.height + distance * 2,
      radius: evaluated.radius + distance,
    };
  }
  addError(
    ctx,
    'offset(...) exact sketch support currently requires rect, circle, or roundrect input.',
    span,
  );
  return null;
}

/**
 * Evaluates sketch fillet with the current evaluation context.
 */
function evalSketchFillet(
  primitive: SketchPrimitive,
  radiusExpr: import('@bushscad/ir').Expr,
  span: import('@bushscad/ir').ASTSourceSpan,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const radius = evalNum(radiusExpr, ctx);
  const evaluated = evalPrimitive(primitive, ctx);
  if (!evaluated) return null;
  if (evaluated.kind === 'rect') {
    return {
      kind: 'roundrect',
      width: evaluated.width,
      height: evaluated.height,
      radius,
    };
  }
  addError(
    ctx,
    'fillet(...) exact sketch support currently requires rect input.',
    span,
  );
  return null;
}

/**
 * Evaluates spline sketch with the current evaluation context.
 */
function evalSplineSketch(
  points: [import('@bushscad/ir').Expr, import('@bushscad/ir').Expr][],
  span: import('@bushscad/ir').ASTSourceSpan,
  ctx: EvalCtx,
): IRPrimitive | null {
  const coords = points.map(
    ([x, y]) => [evalNum(x, ctx), evalNum(y, ctx)] as [number, number],
  );
  if (coords.length === 2) {
    return {
      kind: 'profile',
      segments: [
        { kind: 'line', name: 'spline_1', from: coords[0], to: coords[1] },
      ],
    };
  }
  addError(
    ctx,
    'spline(...) exact sketch support currently requires exactly two points.',
    span,
  );
  return null;
}

/**
 * Evaluates unsupported sketch operation with the current evaluation context.
 */
function evalUnsupportedSketchOperation(
  operation: string,
  span: import('@bushscad/ir').ASTSourceSpan,
  ctx: EvalCtx,
): IRPrimitive | null {
  addError(
    ctx,
    `${operation}(...) is recognized but has no exact sketch geometry implementation yet.`,
    span,
  );
  return null;
}

/**
 * Updates state to record construction.
 */
function markConstruction(primitive: IRPrimitive): IRPrimitive {
  if (primitive.kind === 'profile') {
    return {
      ...primitive,
      segments: primitive.segments.map((segment) => ({
        ...segment,
        construction: true,
      })),
    };
  }
  if (primitive.kind === 'sketchAt' || primitive.kind === 'sketchAlias') {
    return { ...primitive, primitive: markConstruction(primitive.primitive) };
  }
  if (primitive.kind === 'sketchBoolean') {
    return {
      ...primitive,
      left: markConstruction(primitive.left),
      right: markConstruction(primitive.right),
    };
  }
  return { kind: 'profile', segments: [] };
}
