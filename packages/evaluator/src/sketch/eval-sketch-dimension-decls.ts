/**
 * @author Aidan Boissonneault
 * @file eval-sketch-dimension-decls.ts
 * @purpose Evaluates sketch dimension decls for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  IRProfileSegment,
  IRSketchDimension,
  SketchDimensionDecl,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';
import {
  measuredReferenceValue,
  measureSketchDimension,
} from './eval-sketch-reference-values.js';
import { sketchExpressionUsesDimension } from './eval-sketch-scalar-expressions.js';

/**
 * Converts persistent sketch dimension declarations into evaluated IR.
 * Driving dimensions are solver constraints with labels; reference dimensions
 * are annotations that must display measured values without affecting solves.
 */
export function evalSketchDimensions(
  constraints: ConstraintDecl[],
  dimensions: SketchDimensionDecl[],
  segments: IRProfileSegment[],
  ctx: EvalCtx,
): IRSketchDimension[] | undefined {
  const names = new Set(
    [...constraints, ...dimensions].flatMap((item) =>
      item.name ? [item.name] : [],
    ),
  );
  const driving = constraints.flatMap((constraint) =>
    drivingDimension(constraint, segments, names, ctx),
  );
  const reference = dimensions.map((dimension) =>
    referenceDimension(dimension, segments, ctx),
  );
  const all = [...driving, ...reference];
  return all.length > 0 ? all : undefined;
}

/**
 * Handles driving dimension in the sketch flow.
 */
function drivingDimension(
  constraint: ConstraintDecl,
  segments: IRProfileSegment[],
  dimensionNames: Set<string>,
  ctx: EvalCtx,
): IRSketchDimension[] {
  if (
    !constraint.label ||
    !constraint.value ||
    !isDimension(constraint.constraint)
  ) {
    return [];
  }
  return [
    {
      name: constraint.name,
      mode: 'driving',
      dimension: constraint.constraint,
      target: constraint.target,
      property: constraint.property ?? constraint.constraint,
      ref: constraint.ref,
      axis: constraint.axis,
      value: sketchExpressionUsesDimension(constraint.value, dimensionNames)
        ? measureSketchDimension(
            constraint.constraint,
            constraint.target,
            constraint.ref,
            constraint.axis,
            segments,
          )
        : evalNum(constraint.value, ctx),
      label: evalPoint(constraint.label, ctx),
    },
  ];
}

/**
 * Resolves the reference against its owning declaration.
 */
function referenceDimension(
  dimension: SketchDimensionDecl,
  segments: IRProfileSegment[],
  ctx: EvalCtx,
): IRSketchDimension {
  return {
    name: dimension.name,
    mode: 'reference',
    dimension: dimension.dimension,
    target: dimension.target,
    property: dimension.property,
    ref: dimension.ref,
    axis: dimension.axis,
    value: measuredReferenceValue(dimension, segments),
    label: evalPoint(dimension.label, ctx),
  };
}

/**
 * Evaluates point with the current evaluation context.
 */
function evalPoint(
  point: [import('@bushscad/ir').Expr, import('@bushscad/ir').Expr],
  ctx: EvalCtx,
): [number, number] {
  return [evalNum(point[0], ctx), evalNum(point[1], ctx)];
}

/**
 * Returns whether the input meets the `dimension` condition.
 */
function isDimension(
  kind: ConstraintDecl['constraint'],
): kind is IRSketchDimension['dimension'] {
  return ['length', 'distance', 'angle', 'radius', 'diameter'].includes(kind);
}
