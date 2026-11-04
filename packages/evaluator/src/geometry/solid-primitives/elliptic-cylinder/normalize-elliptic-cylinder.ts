import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  numArg,
  positive,
  positiveVec2,
  segments,
  vec2Arg,
} from '../../eval-solid-primitive-values.js';

/** Normalizes the independent start and end ellipse radii. */
export function normalizeEllipticCylinder(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'cylinderElliptic' }> {
  const radius = vec2Arg(args, ctx, ['radius', 'r'], [1, 1], 1);
  return {
    primitive: 'cylinderElliptic',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'cylinderElliptic height',
      span,
      ctx,
    ),
    startRadius: positiveVec2(
      vec2Arg(args, ctx, ['startRadius', 'radiusStart', 'r1'], radius, 2),
      'cylinderElliptic startRadius',
      span,
      ctx,
    ),
    endRadius: positiveVec2(
      vec2Arg(args, ctx, ['endRadius', 'radiusEnd', 'r2'], radius, 3),
      'cylinderElliptic endRadius',
      span,
      ctx,
    ),
    segments: segments(args, ctx, 4),
  };
}
