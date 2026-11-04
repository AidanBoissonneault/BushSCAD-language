import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalAxisExpr } from '../../../expressions/eval-expressions.js';
import type { PrimitiveEvaluator } from '../types.js';

/** Evaluates a nested primitive and its sketch-local x/y placement. */
export function evalSketchAtPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'sketchAt' }>,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const evaluated = evalPrimitive(primitive.primitive, ctx);
  if (!evaluated) return null;
  return {
    kind: 'sketchAt',
    primitive: evaluated,
    x: evalAxisExpr(primitive.x, 'x', ctx),
    y: evalAxisExpr(primitive.y, 'y', ctx),
  };
}
