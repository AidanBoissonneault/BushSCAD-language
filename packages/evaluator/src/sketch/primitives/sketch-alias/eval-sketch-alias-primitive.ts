import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import type { PrimitiveEvaluator } from '../types.js';

/** Evaluates and tags the nested primitive with its authored sketch alias. */
export function evalSketchAliasPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'sketchAlias' }>,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const evaluated = evalPrimitive(primitive.primitive, ctx);
  return evaluated
    ? { kind: 'sketchAlias', name: primitive.name, primitive: evaluated }
    : null;
}
