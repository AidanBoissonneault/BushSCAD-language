import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  optionalNum,
  positive,
} from '../../eval-solid-primitive-values.js';
import { normalizeCylinder } from '../cylinder/normalize-cylinder.js';

/** Adds the rounding-radius contract to normalized cylinder dimensions. */
export function normalizeRoundedCylinder(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  const cylinder = normalizeCylinder('roundedCylinder', args, ctx, span);
  return {
    ...cylinder,
    primitive: 'roundedCylinder',
    roundingRadius: positive(
      optionalNum(args, ctx, ['roundingRadius', 'roundRadius', 'fillet'], 5) ??
        0,
      'roundedCylinder rounding radius',
      span,
      ctx,
      true,
    ),
  };
}
