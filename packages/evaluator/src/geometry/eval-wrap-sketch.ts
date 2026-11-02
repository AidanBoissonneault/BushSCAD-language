/**
 * @author Aidan Boissonneault
 * @file eval-wrap-sketch.ts
 * @purpose Evaluates wrap sketch for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, WrapPoint, WrapSketchPrimitive } from '@bushscad/ir';
import {
  GEOM_EPS,
  pointDistance,
  wrapOutlinePoints,
  wrapProfileSegments,
} from '@bushscad/ir';
import { addError } from '../core/eval-context.js';
import { evalExpr } from '../expressions/eval-expressions.js';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { isPointTuple } from '../core/eval-types.js';
import { evalWrapOptions } from './wrap-options.js';

/**
 * Lowers `wrap(...)` point lists to a closed profile.
 * `wrap` is a sketch-level convenience API. It must turn intent words like
 * convex, concave, smooth, and rounded into real segment topology before OCCT
 * sees the profile.
 */
export function evalWrapSketchPrimitive(
  prim: WrapSketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive {
  const options = evalWrapOptions(prim, ctx);
  const sourcePoints = evalWrapPoints(prim, ctx);
  const points = simplifyPoints(sourcePoints, options.tolerance ?? GEOM_EPS);
  const outline = wrapOutlinePoints(points, prim.mode);
  return {
    kind: 'profile',
    segments: wrapProfileSegments(outline, prim.mode, options),
    wrap: { points: sourcePoints, mode: prim.mode, options },
  };
}

/**
 * Evaluates wrap points with the current evaluation context.
 */
function evalWrapPoints(prim: WrapSketchPrimitive, ctx: EvalCtx): WrapPoint[] {
  const value = evalExpr(prim.points, ctx);
  if (!Array.isArray(value)) {
    addError(ctx, 'wrap() requires a list of points.', prim.points.span);
    return [];
  }
  const points = value.filter((item): item is readonly [number, number] =>
    isPointTuple(item as EvalValue),
  );
  if (points.length !== value.length) {
    addError(
      ctx,
      'wrap() points must be 2D tuples like (x, y).',
      prim.points.span,
    );
  }
  if (points.length < 3)
    addError(ctx, 'wrap() requires at least three points.', prim.points.span);
  return points.map(([x, y]) => [x, y]);
}

/**
 * Handles simplify points in the geometry flow.
 */
function simplifyPoints(points: WrapPoint[], tolerance: number): WrapPoint[] {
  return points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    return index === 0 || pointDistance(point, previous) > tolerance;
  });
}
