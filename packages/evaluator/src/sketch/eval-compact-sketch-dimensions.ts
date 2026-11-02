/**
 * @author Aidan Boissonneault
 * @file eval-compact-sketch-dimensions.ts
 * @purpose Evaluates compact sketch dimensions for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  CompactSketchDimensionDecl,
  IRSketchDimension,
  PathEmbeddedPrimitive,
  PathSketchPrimitive,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';

/**
 * Evaluates compact primitive assignments into persistent editor dimensions.
 * Geometry fields are evaluated by their primitive as usual; this parallel IR
 * metadata preserves the authored driving dimension without expanding implied
 * rectangle or circle topology into profile constraints.
 */
export function evalCompactSketchDimensions(
  dimensions: CompactSketchDimensionDecl[] | undefined,
  ctx: EvalCtx,
): IRSketchDimension[] | undefined {
  if (!dimensions?.length) return undefined;
  return dimensions.map((dimension) => ({
    name: dimension.name,
    mode: 'driving',
    dimension: dimension.dimension,
    target: dimension.target,
    property: dimension.property,
    ref: dimension.ref,
    axis: dimension.axis,
    value: evalNum(dimension.value, ctx),
    labelOffset: dimension.offset ? evalNum(dimension.offset, ctx) : undefined,
  }));
}

/** Collects compact dimensions from primitives embedded in a mixed path. */
export function evalCompactPathDimensions(
  primitive: PathSketchPrimitive,
  ctx: EvalCtx,
): IRSketchDimension[] | undefined {
  let shapeIndex = 0;
  const dimensions = primitive.items.flatMap((item) => {
    if (item.kind !== 'primitive') return [];
    shapeIndex += 1;
    const base = embeddedBase(item.primitive);
    const evaluated = evalCompactSketchDimensions(base.compactDimensions, ctx);
    if (!evaluated || (base.kind !== 'circle' && base.kind !== 'ellipse')) {
      return evaluated ?? [];
    }
    return evaluated.map((dimension) => ({
      ...dimension,
      target:
        base.kind === 'circle' &&
        ['diameter', 'radius'].includes(dimension.target)
          ? `circle_${shapeIndex}_q1`
          : base.kind === 'ellipse' &&
              ['width', 'height'].includes(dimension.target)
            ? `ellipse_${shapeIndex}`
            : dimension.target,
    }));
  });
  return dimensions.length > 0 ? dimensions : undefined;
}

/**
 * Handles embedded base in the sketch flow.
 */
function embeddedBase(
  primitive: PathEmbeddedPrimitive,
): Exclude<PathEmbeddedPrimitive, { kind: 'sketchAt' }> {
  return primitive.kind === 'sketchAt'
    ? embeddedBase(primitive.primitive)
    : primitive;
}
