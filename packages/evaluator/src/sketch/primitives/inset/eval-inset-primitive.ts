import type { SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { addError } from '../../../core/eval-context.js';
import { evalNum } from '../../../expressions/eval-expressions.js';

/** Evaluates inset offsets against the active parent sketch dimensions. */
export function evalInsetPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'inset' }>,
  ctx: EvalCtx,
): { kind: 'rect'; width: number; height: number } | null {
  const parent = ctx.thisContext;
  if (!parent) {
    addError(
      ctx,
      `'inset' sketch primitive requires a parent sketching context`,
      primitive.span,
    );
    return null;
  }
  const dimensions = insetDimensions(parent, evalInsetOffsets(primitive, ctx));
  if (!validInsetDimensions(dimensions, primitive.span, ctx)) return null;
  return { kind: 'rect', ...dimensions };
}

/** Evaluates shared and side-specific inset offsets. */
function evalInsetOffsets(
  primitive: Extract<SketchPrimitive, { kind: 'inset' }>,
  ctx: EvalCtx,
): { left: number; right: number; top: number; bottom: number } {
  const all = primitive.all !== undefined ? evalNum(primitive.all, ctx) : 0;
  const x = primitive.x !== undefined ? evalNum(primitive.x, ctx) : all;
  const y = primitive.y !== undefined ? evalNum(primitive.y, ctx) : all;
  const left = primitive.sides !== undefined ? evalNum(primitive.sides, ctx) : x;
  return {
    left,
    right: left,
    top: primitive.top !== undefined ? evalNum(primitive.top, ctx) : y,
    bottom: primitive.bottom !== undefined ? evalNum(primitive.bottom, ctx) : y,
  };
}

/** Computes the remaining rectangle after applying its inset offsets. */
function insetDimensions(
  parent: { width: number; height: number },
  offsets: { left: number; right: number; top: number; bottom: number },
): { width: number; height: number } {
  return {
    width: parent.width - offsets.left - offsets.right,
    height: parent.height - offsets.top - offsets.bottom,
  };
}

/** Reports invalid dimensions and indicates whether the rectangle is usable. */
function validInsetDimensions(
  dimensions: { width: number; height: number },
  span: Extract<SketchPrimitive, { kind: 'inset' }>['span'],
  ctx: EvalCtx,
): boolean {
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    addError(
      ctx,
      `Inset produces non-positive rectangle dimensions (${dimensions.width} x ${dimensions.height})`,
      span,
    );
    return false;
  }
  return true;
}
