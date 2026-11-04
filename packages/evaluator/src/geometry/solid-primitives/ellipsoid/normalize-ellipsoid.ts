import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  positiveVec3,
  segments,
  vec3Arg,
} from '../../eval-solid-primitive-values.js';

/** Normalizes ellipsoid radii and tessellation settings. */
export function normalizeEllipsoid(
  _operation: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
): IRSolidPrimitiveShape {
  return {
    primitive: 'ellipsoid',
    radius: positiveVec3(
      vec3Arg(args, ctx, ['radius', 'r'], [1, 1, 1]),
      'ellipsoid radius',
      _operation.span,
      ctx,
    ),
    segments: segments(args, ctx, 1),
  };
}
