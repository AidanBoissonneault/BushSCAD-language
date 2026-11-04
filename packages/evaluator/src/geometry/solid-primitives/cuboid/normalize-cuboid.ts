import type {
  IRSolidPrimitiveShape,
  SolidPrimitiveOp,
} from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  type ArgBag,
  named,
  numArg,
  optionalNum,
  positiveVec3,
  segments,
  sizeValue,
} from '../../eval-solid-primitive-values.js';
import { evalExpr } from '../../../expressions/eval-expressions.js';

/** Normalizes cube, cuboid, and roundedCuboid size overloads. */
export function normalizeCuboid(
  primitive: 'cube' | 'cuboid' | 'roundedCuboid',
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'cuboid' | 'roundedCuboid' }> {
  const { size, sourceSpan } = normalizeCuboidSize(
    args,
    ctx,
    span,
    args.roundedCuboidSizeForm === true,
  );
  const sizeForm = primitive === 'roundedCuboid' && args.roundedCuboidSizeForm;
  const radius = optionalNum(args, ctx, ['radius', 'r'], sizeForm ? 1 : 3);
  return {
    primitive: primitive === 'roundedCuboid' ? 'roundedCuboid' : 'cuboid',
    size: positiveVec3(size, `${primitive} size`, sourceSpan, ctx),
    radius,
    segments: segments(args, ctx, sizeForm ? 2 : 4),
  };
}

/** Resolves a size tuple or independent width/depth/height values. */
function normalizeCuboidSize(
  args: ArgBag,
  ctx: EvalCtx,
  fallbackSpan: SolidPrimitiveOp['span'],
  roundedCuboidSizeForm: boolean,
): { size: [number, number, number]; sourceSpan: SolidPrimitiveOp['span'] } {
  const sizeArg = named(args, ['size']);
  const firstPositional = args.positional[0];
  const firstPositionalIsVector =
    firstPositional !== undefined &&
    Array.isArray(evalExpr(firstPositional.value, ctx));
  if (sizeArg) {
    return { size: sizeValue(sizeArg.value, ctx), sourceSpan: sizeArg.span };
  }
  if (
    firstPositional &&
    (roundedCuboidSizeForm ||
      firstPositionalIsVector ||
      !hasCuboidDimensions(args))
  ) {
    return {
      size: sizeValue(firstPositional.value, ctx),
      sourceSpan: firstPositional.span,
    };
  }
  return {
    size: [
      numArg(args, ctx, ['width', 'x'], 0, 1),
      numArg(args, ctx, ['depth', 'y'], 1, 1),
      numArg(args, ctx, ['height', 'z'], 2, 1),
    ],
    sourceSpan: fallbackSpan,
  };
}

/** Detects when cuboid input selects dimensions instead of a size tuple. */
function hasCuboidDimensions(args: ArgBag): boolean {
  return (
    args.positional[1] !== undefined ||
    args.positional[2] !== undefined ||
    named(args, ['depth', 'y', 'height', 'z']) !== undefined
  );
}
