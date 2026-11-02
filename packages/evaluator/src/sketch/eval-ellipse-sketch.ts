/**
 * @author Aidan Boissonneault
 * @file eval-ellipse-sketch.ts
 * @purpose Evaluates ellipse sketch for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EllipsePrimitive, IRPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { evalCompactSketchDimensions } from './eval-compact-sketch-dimensions.js';

const GEOM_EPS = 1e-7;

/** Evaluates a compact ellipse while preserving the equal-axis circle contract. */
export function evalEllipseSketch(
  primitive: EllipsePrimitive,
  ctx: EvalCtx,
): IRPrimitive | null {
  const width = evalNum(primitive.width, ctx);
  const height = evalNum(primitive.height, ctx);
  if (width <= GEOM_EPS || height <= GEOM_EPS) {
    addError(
      ctx,
      'ellipse() width and height must be greater than zero.',
      primitive.span,
    );
    return null;
  }
  const dimensions = evalCompactSketchDimensions(
    primitive.compactDimensions,
    ctx,
  );
  if (Math.abs(width - height) <= GEOM_EPS) {
    return { kind: 'circle', diameter: width, dimensions };
  }
  return { kind: 'ellipse', width, height, dimensions };
}
