import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  evalFont,
  evalNum,
  evalStr,
} from '../../../expressions/eval-expressions.js';

/** Evaluates word text, size, font, and alignment into preview IR. */
export function evalWordPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'word' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'word',
    text: evalStr(primitive.text, ctx),
    size: evalNum(primitive.size, ctx),
    font: evalFont(primitive.font, ctx),
    align: primitive.align ?? 'center',
  };
}
