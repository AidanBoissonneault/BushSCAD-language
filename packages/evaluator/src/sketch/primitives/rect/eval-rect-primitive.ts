/**
 * @author Aidan Boissonneault
 * @file eval-rect-primitive.ts
 * @purpose Evaluates rect primitive for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRRectPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalAxisExpr, evalNum } from '../../../expressions/eval-expressions.js';
import { evalCompactSketchDimensions } from '../../eval-compact-sketch-dimensions.js';

/**
 * Evaluates rectangle dimensions and carries authored side aliases into IR.
 * Side aliases are geometry metadata rather than expressions, so evaluation
 * copies them without a variable lookup while numeric fields use normal units.
 */
export function evalRectPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'rect' }>,
  ctx: EvalCtx,
): IRRectPrimitive {
  const evaluated: IRRectPrimitive = {
    kind: 'rect',
    width: evalAxisExpr(prim.width, 'x', ctx),
    height: evalAxisExpr(prim.height, 'y', ctx),
  };
  if (prim.cornerRadius !== undefined) {
    evaluated.cornerRadius = evalNum(prim.cornerRadius, ctx);
  }
  if (prim.sideNames) evaluated.sideNames = { ...prim.sideNames };
  if (prim.plant) evaluated.plant = prim.plant;
  const dimensions = evalCompactSketchDimensions(prim.compactDimensions, ctx);
  if (dimensions) evaluated.dimensions = dimensions;
  return evaluated;
}
