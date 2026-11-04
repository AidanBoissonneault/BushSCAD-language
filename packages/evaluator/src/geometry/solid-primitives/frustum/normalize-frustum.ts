import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  numArg,
  optionalRadius,
  positive,
  segments,
} from '../../eval-solid-primitive-values.js';

/** Normalizes frustum height and bottom/top radius aliases. */
export function normalizeFrustum(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'frustum',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'frustum height',
      span,
      ctx,
    ),
    radiusBottom: positive(
      optionalRadius(args, ctx, ['d1', 'diameterBottom']) ??
        numArg(args, ctx, ['r1', 'radiusBottom', 'bottomRadius'], 1, 1),
      'frustum bottom radius',
      span,
      ctx,
    ),
    radiusTop: positive(
      optionalRadius(args, ctx, ['d2', 'diameterTop']) ??
        numArg(args, ctx, ['r2', 'radiusTop', 'topRadius'], 2, 0.5),
      'frustum top radius',
      span,
      ctx,
      true,
    ),
    segments: segments(args, ctx, 3),
  };
}
