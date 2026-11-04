import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';

/** Callback contract for recursively evaluating nested sketch primitives. */
export type PrimitiveEvaluator = (
  primitive: SketchPrimitive,
  ctx: EvalCtx,
) => IRPrimitive | null;
