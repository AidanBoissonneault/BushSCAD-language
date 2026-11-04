import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  numArg,
  optionalNum,
  positive,
  segments,
} from '../../eval-solid-primitive-values.js';

/** Normalizes major/minor radii and separate torus segment counts. */
export function normalizeTorus(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'torus',
    majorRadius: positive(
      numArg(args, ctx, ['majorRadius', 'outerRadius', 'ro'], 0, 10),
      'torus majorRadius',
      span,
      ctx,
    ),
    minorRadius: positive(
      numArg(args, ctx, ['minorRadius', 'innerRadius', 'ri'], 1, 2),
      'torus minorRadius',
      span,
      ctx,
    ),
    majorSegments: segments(args, ctx, 2, ['segments', 'majorSegments', 'fn']),
    minorSegments: Math.max(
      8,
      Math.round(
        optionalNum(args, ctx, ['minorSegments', 'tubeSegments'], 3) ?? 16,
      ),
    ),
  };
}
