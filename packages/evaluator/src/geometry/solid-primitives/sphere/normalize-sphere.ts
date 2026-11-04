import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  positive,
  radiusArg,
  segments,
} from '../../eval-solid-primitive-values.js';

/** Normalizes sphere and geodesicSphere arguments into the bridge shape form. */
export function normalizeSphere(
  operation: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
): IRSolidPrimitiveShape {
  return {
    primitive:
      operation.primitive === 'geodesicSphere' ? 'geodesicSphere' : 'sphere',
    radius: positive(
      radiusArg(args, ctx, 0),
      'sphere radius',
      operation.span,
      ctx,
    ),
    segments: segments(args, ctx, 1),
  };
}
