import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalNum } from '../../../expressions/eval-expressions.js';

/** Evaluates the coordinate expressions and metadata for polygon(). */
export function evalPolygonPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'polygon' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'polygon',
    points: primitive.points.map(([x, y]) => [evalNum(x, ctx), evalNum(y, ctx)]),
    plant: primitive.plant,
  };
}
