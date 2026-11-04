import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalNum } from '../../../expressions/eval-expressions.js';

/** Evaluates width, height, and radius for roundrect(). */
export function evalRoundRectPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'roundrect' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'roundrect',
    width: evalNum(primitive.width, ctx),
    height: evalNum(primitive.height, ctx),
    radius: evalNum(primitive.radius, ctx),
  };
}
