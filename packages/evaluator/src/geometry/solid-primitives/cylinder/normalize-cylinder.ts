import type {
  IRSolidPrimitiveShape,
  SolidPrimitiveOp,
} from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  numArg,
  optionalRadius,
  positive,
  radiusArg,
  segments,
} from '../../eval-solid-primitive-values.js';

/** Normalizes cylinder dimensions, optional end radii, and segment count. */
export function normalizeCylinder(
  primitive: 'cylinder' | 'roundedCylinder',
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cylinder' | 'roundedCylinder' }
> {
  const height = positive(
    numArg(args, ctx, ['height', 'h'], 0, 1),
    'cylinder height',
    span,
    ctx,
  );
  const radius = radiusArg(args, ctx, 1);
  return {
    primitive,
    height,
    radius: positive(radius, 'cylinder radius', span, ctx),
    radiusTop: optionalRadius(
      args,
      ctx,
      ['r2', 'radiusTop', 'topRadius', 'd2', 'diameterTop'],
      3,
    ),
    radiusBottom: optionalRadius(
      args,
      ctx,
      ['r1', 'radiusBottom', 'bottomRadius', 'd1', 'diameterBottom'],
      2,
    ),
    segments: segments(args, ctx, 4),
  };
}
