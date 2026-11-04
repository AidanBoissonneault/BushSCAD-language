import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  numArg,
  positive,
  radiusArg,
  segments,
} from '../../eval-solid-primitive-values.js';

/** Normalizes cone height, base radius, and tessellation settings. */
export function normalizeCone(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'cone',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'cone height',
      span,
      ctx,
    ),
    radiusBottom: positive(radiusArg(args, ctx, 1), 'cone radius', span, ctx),
    radiusTop: 0,
    segments: segments(args, ctx, 2),
  };
}
