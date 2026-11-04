import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { evalNum } from '../../../expressions/eval-expressions.js';
import { evalCompactSketchDimensions } from '../../eval-compact-sketch-dimensions.js';

/** Evaluates circle diameter and its optional compact dimensions. */
export function evalCirclePrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'circle' }>,
  ctx: EvalCtx,
): IRPrimitive {
  const evaluated: Extract<IRPrimitive, { kind: 'circle' }> = {
    kind: 'circle',
    diameter: evalNum(primitive.diameter, ctx),
  };
  const dimensions = evalCompactSketchDimensions(
    primitive.compactDimensions,
    ctx,
  );
  if (dimensions) evaluated.dimensions = dimensions;
  return evaluated;
}
