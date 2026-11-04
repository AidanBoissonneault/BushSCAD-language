import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalNum } from '../../../expressions/eval-expressions.js';

/** Evaluates the base and height expressions for triangle(). */
export function evalTrianglePrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'triangle' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'triangle',
    base: evalNum(primitive.base, ctx),
    height: evalNum(primitive.height, ctx),
  };
}
